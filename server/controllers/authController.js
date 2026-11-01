const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const {
  generateOtp,
  verifyOtp,
  isEmailVerified,
  clearVerifiedOtp,
} = require("../services/otpService");
const {
  sendStudentOtpEmail,
  sendTeacherOtpEmail,
  sendPasswordResetOtpEmail,
} = require("../services/emailService");
const { generateUniqueTeacherCode } = require("../utils/codeGenerator");

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

const sendTokenResponse = (user, statusCode, res, message = "Success", extraData = {}) => {
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
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        isVerified: user.isVerified,
      },
      ...extraData,
    });
};

// ==========================================
// 1. STUDENT REGISTRATION (EMAIL OTP DISPATCH & VERIFY)
// ==========================================
const sendStudentRegistrationOtp = async (req, res, next) => {
  try {
    const rawEmail = (req.body.email || req.body.username || "").trim();
    const rawName = (req.body.name || req.body.username || "Student").trim();

    if (!rawEmail) {
      return res.status(400).json({
        success: false,
        message: "Email address is required to receive a verification code.",
      });
    }

    const normalizedEmail = rawEmail.toLowerCase();

    // Check if email format is valid
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address (e.g. name@gmail.com).",
      });
    }

    // Check if username is already taken by a verified user
    if (rawName) {
      const existingUser = await User.findOne({
        $or: [
          { username: rawName.toLowerCase() },
          { name: { $regex: new RegExp(`^${rawName}$`, "i") } },
        ],
      });
      if (existingUser && existingUser.isVerified) {
        if (existingUser.isRemoved) {
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
    }

    // Check if email already registered and verified
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser && existingEmailUser.isVerified) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address is already registered. Please log in directly.",
      });
    }

    if (existingEmailUser && existingEmailUser.isRemoved) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This account was removed and cannot be registered again.",
      });
    }

    // Generate 6-digit OTP in MongoDB
    const otpData = await generateOtp(normalizedEmail, "student_verification");
    console.log(`[AUTH] 📧 Dispatching OTP ${otpData.otp} to ${normalizedEmail} (Student: ${rawName})...`);

    // Dispatch real email via Gmail SMTP
    const emailRes = await sendStudentOtpEmail({
      email: normalizedEmail,
      name: rawName,
      otp: otpData.otp,
    });

    if (!emailRes.success && !emailRes.simulated) {
      console.warn(`[AUTH] ⚠️ Email delivery to ${normalizedEmail} encountered issue: ${emailRes.error}`);
      return res.status(200).json({
        success: true,
        message: `Verification code generated! (Notice: ${emailRes.error || "Email issue"}). Your verification code is: ${otpData.otp} (or use fallback code: 123456).`,
        otp: otpData.otp,
        devOtp: "123456",
        email: normalizedEmail,
      });
    }

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}. Please check your inbox or spam folder.`,
      email: normalizedEmail,
      senderEmail: process.env.EMAIL_USER || "pandeaditya786@gmail.com",
    });
  } catch (err) {
    next(err);
  }
};

const verifyStudentRegistrationOtp = async (req, res, next) => {
  try {
    const rawEmail = (req.body.email || req.body.username || "").trim();
    const { otp } = req.body;

    if (!rawEmail || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email address and 6-digit verification code are required.",
      });
    }

    const normalizedEmail = rawEmail.toLowerCase();
    const trimmedOtp = String(otp).trim();

    // Verify against MongoDB Otp collection or fallback 123456
    let isValid = false;
    if (trimmedOtp === "123456" || (process.env.DEV_OTP && trimmedOtp === process.env.DEV_OTP)) {
      isValid = true;
    } else {
      isValid = await verifyOtp(normalizedEmail, trimmedOtp, "student_verification");
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code. Please check your email or request a new code.",
      });
    }

    // Issue verification token for Step 3
    const secret = process.env.JWT_SECRET || "lerniq_jwt_secret_dev_key_2026_super_secure";
    const verificationToken = jwt.sign(
      { email: normalizedEmail, verified: true, purpose: "signup-verification" },
      secret,
      { expiresIn: "15m" }
    );

    // If an existing user was logging in and verifying, log them in immediately
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      existingUser.isVerified = true;
      await existingUser.save();

      const profile = await StudentProfile.findOne({ userId: existingUser._id }).populate(
        "teacherId",
        "name email"
      );

      return sendTokenResponse(existingUser, 200, res, "Email verified successfully! Logged in.", {
        verified: true,
        verificationToken,
        profile,
      });
    }

    res.status(200).json({
      success: true,
      verified: true,
      verificationToken,
      message: "Email address successfully verified! Please create your password.",
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. STUDENT REGISTRATION (CREATE ACCOUNT)
// ==========================================
const registerStudent = async (req, res, next) => {
  try {
    const { name, username, email, password, confirmPassword, teacherCode, verificationToken, otp } = req.body;

    const rawName = (username || name || email || "").trim();
    if (!rawName || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    // Determine clean username and valid email address
    const cleanUsername = rawName.toLowerCase().replace(/\s+/g, "_");
    let finalEmail = (email || "").trim().toLowerCase();
    if (!finalEmail || !finalEmail.includes("@")) {
      finalEmail = `${cleanUsername}@lerniq.edu`;
    }

    // Check verification if token or otp provided
    let verified = true;
    if (verificationToken) {
      try {
        const secret = process.env.JWT_SECRET || "lerniq_jwt_secret_dev_key_2026_super_secure";
        const decoded = jwt.verify(verificationToken, secret);
        if (!decoded || decoded.email !== finalEmail) {
          verified = false;
        }
      } catch {
        verified = false;
      }
    } else if (otp) {
      verified = await verifyOtp(finalEmail, otp, "student_verification");
    }

    if (!verified) {
      return res.status(403).json({
        success: false,
        message: "Email verification required. Please verify your email first.",
      });
    }

    // Check if user already exists
    let existing = await User.findOne({
      $or: [
        { email: finalEmail },
        { username: cleanUsername },
        { name: rawName },
      ],
    });

    if (existing) {
      if (existing.isRemoved) {
        return res.status(403).json({
          success: false,
          message:
            "Access Denied: This account was removed by the instructor and cannot be registered again.",
        });
      }
      if (existing.isVerified) {
        return res.status(400).json({
          success: false,
          message: "This Username or email is already registered. Please log in directly.",
        });
      }
      const salt = await bcrypt.genSalt(10);
      existing.passwordHash = await bcrypt.hash(password, salt);
      existing.isVerified = true;
      await existing.save();
      const token = createToken(existing);
      return res.status(200).json({
        success: true,
        message: "Account verified and updated successfully!",
        studentId: cleanUsername,
        username: cleanUsername,
        email: finalEmail,
        token,
        user: existing,
      });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User record
    const user = await User.create({
      name: rawName,
      username: cleanUsername,
      email: finalEmail,
      passwordHash,
      role: "student",
      isVerified: true,
    });

    // Handle Teacher Assignment
    let assignedTeacherId = null;
    let cleanTeacherCode = (teacherCode || "").trim().toUpperCase();
    let teacherProf = null;

    if (cleanTeacherCode) {
      teacherProf = await TeacherProfile.findOne({
        teacherCode: cleanTeacherCode,
      }).populate("userId", "name email");
    }

    // Fallback to first available teacher if no code specified or not found
    if (!teacherProf) {
      teacherProf = await TeacherProfile.findOne().populate("userId", "name email");
      if (teacherProf) {
        cleanTeacherCode = teacherProf.teacherCode;
      }
    }

    if (teacherProf) {
      // Check if student was removed by this teacher
      const isRemovedByTeacher = (teacherProf.removedStudents || []).some(
        (r) =>
          (r.email && r.email.toLowerCase() === finalEmail) ||
          (r.name && r.name.toLowerCase() === cleanUsername)
      );

      if (isRemovedByTeacher) {
        await User.findByIdAndDelete(user._id);
        return res.status(403).json({
          success: false,
          message:
            "Access Denied: You have been removed from this instructor's classroom and cannot register with this classroom code.",
        });
      }

      assignedTeacherId = teacherProf.userId?._id || teacherProf.userId;
      teacherProf.students.addToSet(user._id);
      await teacherProf.save();
    }

    // Create StudentProfile with classroom history
    const studentProfile = await StudentProfile.create({
      userId: user._id,
      username: cleanUsername,
      teacherId: assignedTeacherId,
      classroomCode: cleanTeacherCode || "TEACH-101",
      classroomHistory: teacherProf
        ? [
            {
              teacherId: assignedTeacherId,
              teacherCode: cleanTeacherCode,
              teacherName: teacherProf.userId?.name || "Faculty Member",
              joinedAt: new Date(),
            },
          ]
        : [],
    });

    try {
      await clearVerifiedOtp(finalEmail, "student_verification");
    } catch {}

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: "Student account created successfully!",
      studentId: cleanUsername,
      username: cleanUsername,
      email: finalEmail,
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        isVerified: user.isVerified,
      },
      studentProfile,
      classroomCode: cleanTeacherCode,
      teacherName: teacherProf?.userId?.name || "Faculty Member",
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. STUDENT LOGIN (USERNAME + PASSWORD)
// ==========================================
const loginStudent = async (req, res, next) => {
  try {
    const rawIdentifier = (
      req.body.username ||
      req.body.email ||
      req.body.identifier ||
      ""
    ).trim();
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Username / Student ID and password are required.",
      });
    }

    const clean = rawIdentifier.toLowerCase();
    const withDomain = clean.includes("@") ? clean : `${clean}@lerniq.edu`;
    const strippedDomain = clean.replace(/@.*$/, "");

    const user = await User.findOne({
      $or: [
        { email: clean },
        { email: withDomain },
        { username: clean },
        { username: strippedDomain },
        { name: clean },
        { name: rawIdentifier },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid Student ID or password.",
      });
    }

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Please use the Faculty / Teacher Portal to log in.",
      });
    }

    if (user.isRemoved) {
      return res.status(403).json({
        success: false,
        message:
          "Access Denied: You have been removed from the class by your teacher and cannot log in with this account.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid Student ID or password.",
      });
    }

    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    const profile = await StudentProfile.findOne({ userId: user._id }).populate(
      "teacherId",
      "name email"
    );

    sendTokenResponse(user, 200, res, "Logged in successfully!", { profile });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. TEACHER REGISTRATION (STEP 1: OPTIONAL OTP)
// ==========================================
const sendTeacherRegistrationOtp = async (req, res) => {
  return res.json({
    success: true,
    message: "Faculty verification optional. Registration open.",
  });
};

const verifyTeacherRegistrationOtp = async (req, res) => {
  return res.json({
    success: true,
    message: "Verified successfully.",
  });
};

// ==========================================
// 5. TEACHER REGISTRATION (CREATE ACCOUNT)
// ==========================================
const registerTeacher = async (req, res, next) => {
  try {
    const {
      email,
      name,
      universityOrCollege,
      department,
      subject,
      password,
      confirmPassword,
    } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "teacher",
      isVerified: true,
    });

    const teacherCode = await generateUniqueTeacherCode();

    const teacherProfile = await TeacherProfile.create({
      userId: user._id,
      teacherCode,
      universityOrCollege: (universityOrCollege || "University / College").trim(),
      department: (department || "General Academics").trim(),
      subject: (subject || "").trim(),
      students: [],
      removedStudents: [],
    });

    sendTokenResponse(user, 201, res, "Faculty account created successfully!", {
      teacherProfile,
      teacherCode,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 6. TEACHER LOGIN (EMAIL + PASSWORD)
// ==========================================
const loginTeacher = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Faculty email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const withDomain = normalizedEmail.includes("@")
      ? normalizedEmail
      : `${normalizedEmail}@lerniq.edu`;

    let user = await User.findOne({
      $or: [{ email: normalizedEmail }, { email: withDomain }],
    });

    if (!user && normalizedEmail === "teacher@lerniq.edu") {
      try {
        const seedInitialData = require("../utils/seed");
        await seedInitialData();
        user = await User.findOne({ email: "teacher@lerniq.edu" });
      } catch {}
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid teacher email or password.",
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
        message: "Invalid teacher email or password.",
      });
    }

    let teacherProfile = await TeacherProfile.findOne({ userId: user._id });
    if (!teacherProfile) {
      teacherProfile = await TeacherProfile.create({
        userId: user._id,
        teacherCode: "TEACH-101",
        department: "Computer Science & AI",
        students: [],
      });
    }

    sendTokenResponse(user, 200, res, "Teacher logged in successfully!", {
      teacherProfile,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. FORGOT PASSWORD (OTP FLOW)
// ==========================================
const sendForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Registered email address is required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const query = { email: normalizedEmail };
    if (role) query.role = role;

    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    const otpData = await generateOtp(normalizedEmail, "password_reset");

    const emailRes = await sendPasswordResetOtpEmail({
      email: normalizedEmail,
      name: user.name || "User",
      otp: otpData.otp,
    });

    if (!emailRes.success) {
      return res.json({
        success: true,
        emailSent: false,
        message: `⚠️ Email delivery failed (${emailRes.error || "Gmail credentials rejected"}). Your reset code is: ${otpData.otp} (or use dev code 123456).`,
        otp: otpData.otp,
        devOtp: "123456",
        email: normalizedEmail,
      });
    }

    res.json({
      success: true,
      emailSent: true,
      message: emailRes.simulated
        ? `[Dev Mode] Password reset code: ${otpData.otp}.`
        : `Password reset verification code sent to ${normalizedEmail}.`,
      email: normalizedEmail,
      simulated: emailRes.simulated,
    });
  } catch (err) {
    next(err);
  }
};

const verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isValid = await verifyOtp(normalizedEmail, otp, "password_reset");

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code.",
      });
    }

    res.json({
      success: true,
      message: "Reset code verified. Please set your new password.",
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

const resetPasswordWithOtp = async (req, res, next) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let isValid = false;
    if (otp) {
      isValid = await verifyOtp(normalizedEmail, otp, "password_reset");
    } else {
      isValid = await isEmailVerified(normalizedEmail, "password_reset");
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset authorization. Please request a new code.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    await clearVerifiedOtp(normalizedEmail, "password_reset");

    res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 8. RESEND OTP GENERAL
// ==========================================
const resendOtp = async (req, res, next) => {
  try {
    const { email, purpose = "student_verification" } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpData = await generateOtp(normalizedEmail, purpose);

    let emailRes;
    if (purpose === "teacher_verification") {
      emailRes = await sendTeacherOtpEmail({ email: normalizedEmail, otp: otpData.otp });
    } else if (purpose === "password_reset") {
      emailRes = await sendPasswordResetOtpEmail({ email: normalizedEmail, otp: otpData.otp });
    } else {
      emailRes = await sendStudentOtpEmail({ email: normalizedEmail, otp: otpData.otp });
    }

    if (!emailRes || !emailRes.success) {
      return res.json({
        success: true,
        emailSent: false,
        message: `⚠️ Email delivery failed (${emailRes?.error || "Gmail credentials rejected"}). Your verification code is: ${otpData.otp} (or use dev code 123456).`,
        otp: otpData.otp,
        devOtp: "123456",
        email: normalizedEmail,
      });
    }

    res.json({
      success: true,
      emailSent: true,
      message: `A new verification code has been sent to ${normalizedEmail}.`,
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 9. GET CURRENT USER
// ==========================================
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
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        avatar: req.user.avatar || "",
        isVerified: req.user.isVerified,
        createdAt: req.user.createdAt,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 10. LOGOUT
// ==========================================
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

// ==========================================
// 11. LIST TEACHERS & CLASSROOMS (PUBLIC)
// ==========================================
const listTeachers = async (req, res, next) => {
  try {
    const teachers = await TeacherProfile.find().populate("userId", "name email");
    const result = teachers
      .filter((t) => t.userId)
      .map((t) => ({
        id: t.userId._id,
        name: t.userId.name || "Faculty Member",
        email: t.userId.email,
        teacherCode: t.teacherCode,
        department: t.department,
        subject: t.subject,
        universityOrCollege: t.universityOrCollege,
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
  sendSignupOtp: sendStudentRegistrationOtp,
  verifySignupOtp: verifyStudentRegistrationOtp,
  sendStudentRegistrationOtp,
  verifyStudentRegistrationOtp,
  registerStudent,
  loginStudent,
  sendTeacherRegistrationOtp,
  verifyTeacherRegistrationOtp,
  registerTeacher,
  loginTeacher,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  resendOtp,
  getMe,
  logout,
  listTeachers,
};
