const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const { generateOtp, verifyOtp } = require("../services/otpService");
const { sendStudentOtpEmail } = require("../services/emailService");

const createToken = (user) => {
  const secret = process.env.JWT_SECRET || "lerniq_jwt_secret_dev_key_2026_super_secure";
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: "7d" }
  );
};

const sendTokenResponse = (user, statusCode, res, message = "Success") => {
  const token = createToken(user);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      message,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        isVerified: user.isVerified,
      },
    });
};

/**
 * Send OTP for Student Signup
 */
const sendSignupOtp = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const trimmedName = name.trim();
    let finalEmail = email.toLowerCase().trim();
    if (!finalEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address (e.g. student@gmail.com).",
      });
    }

    // Check if Username is already taken
    const existingUsername = await User.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });
    if (existingUsername) {
      if (existingUsername.isRemoved) {
        return res.status(403).json({
          success: false,
          message: "Access Denied: This username was previously removed by an instructor.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "This Username is already taken. Please choose another username.",
      });
    }

    // Check if Email is already registered and verified
    const existingEmail = await User.findOne({ email: finalEmail });
    if (existingEmail && existingEmail.isVerified) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists. Please log in instead.",
      });
    }

    if (existingEmail && existingEmail.isRemoved) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This account was removed and cannot be registered again.",
      });
    }

    // Generate 6-digit OTP
    const otpData = await generateOtp(finalEmail);

    // Send email using Gmail SMTP
    const emailRes = await sendStudentOtpEmail({
      email: finalEmail,
      name: trimmedName,
      otp: otpData.otp,
    });

    if (!emailRes.success && !emailRes.simulated) {
      return res.status(500).json({
        success: false,
        message: `Failed to dispatch email: ${emailRes.error || "Please verify your email address and try again."}`,
      });
    }

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${finalEmail}.`,
      email: finalEmail,
      senderEmail: process.env.EMAIL_USER || "pandeaditya786@gmail.com",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify OTP during Student Signup
 */
const verifySignupOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and 6-digit verification code are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isValid = await verifyOtp(normalizedEmail, otp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code. Please check and try again.",
      });
    }

    // Sign a temporary verification token (valid for 15 minutes to finish setting password)
    const secret = process.env.JWT_SECRET || "lerniq_jwt_secret_dev_key_2026_super_secure";
    const verificationToken = jwt.sign(
      { email: normalizedEmail, verified: true, purpose: "signup-verification" },
      secret,
      { expiresIn: "15m" }
    );

    res.status(200).json({
      success: true,
      verified: true,
      verificationToken,
      message: "Email address successfully verified!",
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Register Student
 */
const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password, teacherCode, verificationToken, otp } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: "Name and password are required.",
      });
    }

    // Treat email as username if no @ is present
    let finalEmail = email;
    if (finalEmail && !finalEmail.includes('@')) {
      finalEmail = finalEmail + '@lerniq.edu';
    } else if (!finalEmail) {
      finalEmail = `student_${Date.now().toString().slice(-6)}@lerniq.edu`;
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const normalizedEmail = finalEmail.toLowerCase().trim();
    const trimmedName = name.trim();

    // Verify verificationToken or OTP if provided
    let isEmailVerified = false;
    const secret = process.env.JWT_SECRET || "lerniq_jwt_secret_dev_key_2026_super_secure";

    if (verificationToken) {
      try {
        const decoded = jwt.verify(verificationToken, secret);
        if (decoded && decoded.email === normalizedEmail) {
          isEmailVerified = true;
        }
      } catch (tokenErr) {
        // Invalid or expired token
      }
    }

    if (!isEmailVerified && otp) {
      const otpValid = await verifyOtp(normalizedEmail, otp);
      if (otpValid) {
        isEmailVerified = true;
      }
    }

    // If verification token or otp was provided but failed, reject
    if ((verificationToken || otp) && !isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email verification expired or invalid. Please verify your email again.",
      });
    }

    // Check existing User
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.isRemoved) {
        return res.status(403).json({
          success: false,
          message: "Access Denied: This account was removed by the instructor and cannot be registered or used again with this email.",
        });
      }
      if (existing.isVerified) {
        return res.status(400).json({
          success: false,
          message: "An account with this email already exists. Please log in instead.",
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create or update user
    let user;
    if (existing && !existing.isVerified) {
      existing.name = trimmedName;
      existing.passwordHash = passwordHash;
      existing.isVerified = true;
      user = await existing.save();
    } else {
      user = await User.create({
        name: trimmedName,
        email: normalizedEmail,
        passwordHash,
        role: "student",
        isVerified: true,
      });
    }

    // Handle Teacher Assignment
    let assignedTeacherId = null;
    if (teacherCode && teacherCode.trim()) {
      const teacherProf = await TeacherProfile.findOne({
        teacherCode: teacherCode.trim().toUpperCase(),
      });
      if (teacherProf) {
        assignedTeacherId = teacherProf.userId;
        teacherProf.students.addToSet(user._id);
        await teacherProf.save();
      }
    } else {
      // Auto-assign to default teacher if available
      const defaultTeacher = await TeacherProfile.findOne();
      if (defaultTeacher) {
        assignedTeacherId = defaultTeacher.userId;
        defaultTeacher.students.addToSet(user._id);
        await defaultTeacher.save();
      }
    }

    // Create or update StudentProfile
    const existingProfile = await StudentProfile.findOne({ userId: user._id });
    if (!existingProfile) {
      await StudentProfile.create({
        userId: user._id,
        teacherId: assignedTeacherId,
      });
    }

    res.status(201).json({
      success: true,
      message: "Student account created and verified successfully!",
      requiresOtp: false,
      email: normalizedEmail,
      studentId: user.name,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify Student OTP (Existing route)
 */
const verifyStudentOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP code are required.",
      });
    }

    const isValid = await verifyOtp(email, otp);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please check and try again.",
      });
    }

    let finalEmail = email.toLowerCase().trim();
    if (!finalEmail.includes('@')) {
      finalEmail = finalEmail + '@lerniq.edu';
    }

    const user = await User.findOne({ email: finalEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.isVerified = true;
    await user.save();

    sendTokenResponse(user, 200, res, "Email verified successfully!");
  } catch (err) {
    next(err);
  }
};

/**
 * Resend OTP (Supports both existing users and new signups)
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    let finalEmail = email.toLowerCase().trim();
    if (!finalEmail.includes('@')) {
      finalEmail = finalEmail + '@lerniq.edu';
    }

    const user = await User.findOne({ email: finalEmail });
    const recipientName = user ? user.name : (name || "Student");

    const otpData = await generateOtp(finalEmail);

    const emailRes = await sendStudentOtpEmail({
      email: finalEmail,
      name: recipientName,
      otp: otpData.otp,
    });

    if (!emailRes.success && !emailRes.simulated) {
      return res.status(500).json({
        success: false,
        message: `Failed to resend code: ${emailRes.error || "Please try again."}`,
      });
    }

    res.json({
      success: true,
      message: `A new OTP verification code has been sent to your email from ${process.env.EMAIL_USER || "pandeaditya786@gmail.com"}.`,
      senderEmail: process.env.EMAIL_USER || "pandeaditya786@gmail.com",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Student Login
 */
const loginStudent = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const trimmedInput = email.trim();
    const normalizedEmail = trimmedInput.toLowerCase();

    // Allow student to log in using either their Email or their Username
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { email: normalizedEmail.includes("@") ? normalizedEmail : `${normalizedEmail}@lerniq.edu` },
        { name: { $regex: new RegExp(`^${trimmedInput}$`, "i") } },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    if (user.isRemoved) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You have been removed from the class by your teacher and cannot log in again with this email.",
      });
    }

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Please use the Teacher login portal.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // If not verified, require OTP verification
    if (!user.isVerified) {
      const otpData = await generateOtp(user.email);
      await sendStudentOtpEmail({
        email: user.email,
        name: user.name,
        otp: otpData.otp,
      });
      return res.status(403).json({
        success: false,
        message: "Account not verified. A verification code has been sent to your email from adityapande78@gmail.com.",
        requiresOtp: true,
        email: user.email,
        senderEmail: "adityapande78@gmail.com",
      });
    }

    sendTokenResponse(user, 200, res, "Logged in successfully!");
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher Login
 */
const loginTeacher = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    let finalEmail = email.toLowerCase().trim();
    if (!finalEmail.includes('@')) {
      finalEmail = finalEmail + '@lerniq.edu';
    }

    const user = await User.findOne({ email: finalEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid teacher credentials.",
      });
    }

    if (user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This account is registered as a student.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid teacher credentials.",
      });
    }

    sendTokenResponse(user, 200, res, "Teacher logged in successfully!");
  } catch (err) {
    next(err);
  }
};

/**
 * Current User Profile (Me)
 */
const getMe = async (req, res, next) => {
  try {
    let profile = null;

    if (req.user.role === "student") {
      profile = await StudentProfile.findOne({ userId: req.user._id }).populate(
        "teacherId",
        "name email"
      );
    } else if (req.user.role === "teacher") {
      profile = await TeacherProfile.findOne({ userId: req.user._id });
    }

    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        avatar: req.user.avatar || (profile?.avatar || ""),
        isVerified: req.user.isVerified,
        createdAt: req.user.createdAt,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout
 */
const logout = async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
  });

  res.json({
    success: true,
    message: "Logged out successfully.",
  });
};

/**
 * List available teachers (Public for student registration selection)
 */
const listTeachers = async (req, res, next) => {
  try {
    const teachers = await TeacherProfile.find().populate("userId", "name email");
    const result = teachers.map((t) => ({
      id: t.userId?._id,
      name: t.userId?.name || "Faculty Member",
      email: t.userId?.email,
      teacherCode: t.teacherCode,
      department: t.department,
    }));

    res.json({
      success: true,
      teachers: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendSignupOtp,
  verifySignupOtp,
  registerStudent,
  verifyStudentOtp,
  resendOtp,
  loginStudent,
  loginTeacher,
  getMe,
  logout,
  listTeachers,
};
