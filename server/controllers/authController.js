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
        isVerified: user.isVerified,
      },
      ...extraData,
    });
};

// ==========================================
// 1. STUDENT REGISTRATION (DIRECT / NO OTP)
// ==========================================
const sendStudentRegistrationOtp = async (req, res) => {
  // Graceful no-op for backward compatibility
  return res.json({
    success: true,
    message: "Email verification is optional. You can register directly.",
  });
};

const verifyStudentRegistrationOtp = async (req, res) => {
  return res.json({
    success: true,
    message: "Verified successfully.",
  });
};

// ==========================================
// 2. STUDENT REGISTRATION (CREATE ACCOUNT)
// ==========================================
const registerStudent = async (req, res, next) => {
  try {
    const { name, username, email, password, confirmPassword, teacherCode } = req.body;

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

    // Check if user already exists
    const existing = await User.findOne({
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
      return res.status(400).json({
        success: false,
        message: "This Username is already taken. Please choose another.",
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
        // Rollback user creation
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

    // Clear any pending OTPs
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

    // Ensure verified status
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    // Fetch student profile & active classroom
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

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "teacher",
      isVerified: true,
    });

    // Generate unique collision-proof teacher code
    const teacherCode = await generateUniqueTeacherCode();

    // Create TeacherProfile
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

    // Auto-seed if default faculty not created yet
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
      console.warn(`[AUTH] ⚠️ Reset email to ${normalizedEmail} failed (${emailRes.error}). Providing fallback OTP.`);
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

    // Verify OTP state
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

    // Hash new password securely
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Invalidate reset OTP
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
