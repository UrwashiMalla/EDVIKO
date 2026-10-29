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
        isVerified: user.isVerified,
      },
    });
};

/**
 * Register Student
 */
const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password, teacherCode } = req.body;

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
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This Username is already taken. Please choose another.",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "student",
      isVerified: true, // AUTO VERIFY TO BYPASS EMAIL
    });

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

    // Create StudentProfile
    await StudentProfile.create({
      userId: user._id,
      teacherId: assignedTeacherId,
    });

    res.status(201).json({
      success: true,
      message: "Student account created successfully!",
      requiresOtp: false,
      email: normalizedEmail,
      studentId: normalizedEmail.split('@')[0], // Give them the ID
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify Student OTP
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
 * Resend OTP
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
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
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const otpData = await generateOtp(user.email);

    await sendStudentOtpEmail({
      email: user.email,
      name: user.name,
      otp: otpData.otp,
    });

    res.json({
      success: true,
      message: "A new OTP verification code has been sent to your email from adityapande78@gmail.com.",
      senderEmail: "adityapande78@gmail.com",
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

    let finalEmail = email.toLowerCase().trim();
    if (!finalEmail.includes('@')) {
      finalEmail = finalEmail + '@lerniq.edu';
    }

    const user = await User.findOne({ email: finalEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
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
  registerStudent,
  verifyStudentOtp,
  resendOtp,
  loginStudent,
  loginTeacher,
  getMe,
  logout,
  listTeachers,
};
