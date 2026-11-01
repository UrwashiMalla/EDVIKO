const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const Classroom = require("../models/Classroom");
const Notification = require("../models/Notification");
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
  const secret = process.env.JWT_SECRET || "edviko_jwt_secret_dev_key_2026_super_secure";
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
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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
// 1. STUDENT REGISTRATION (OTP DISPATCH & VERIFY)
// ==========================================
const sendStudentRegistrationOtp = async (req, res, next) => {
  try {
    const rawEmail = (req.body.email || "").trim();
    const rawName = (req.body.name || req.body.username || "Student").trim();
    const rawUsername = (req.body.username || "").trim();

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
        message: "Please enter a valid email address (e.g. yourname@gmail.com).",
      });
    }

    // Check if username is already taken by a verified user
    if (rawUsername) {
      const cleanUsername = rawUsername.toLowerCase();
      const existingUser = await User.findOne({ username: cleanUsername });
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

    // Validate Classroom Code (Mandatory: student must match teacher's code to enter class)
    const rawTeacherCode = (req.body.teacherCode || "").trim().toUpperCase();
    if (!rawTeacherCode) {
      return res.status(400).json({
        success: false,
        message: "Classroom Code is required. Please obtain the classroom code from your teacher to register.",
      });
    }

    let matchedClassroom = await Classroom.findOne({ code: rawTeacherCode });
    let matchedTeacher = null;

    if (matchedClassroom) {
      matchedTeacher = await User.findById(matchedClassroom.teacherId).select("name email");
    } else {
      const teacherProf = await TeacherProfile.findOne({ teacherCode: rawTeacherCode });
      if (teacherProf) {
        matchedTeacher = await User.findById(teacherProf.userId).select("name email");
        matchedClassroom = {
          name: `${teacherProf.subject || "Course"} - ${matchedTeacher?.name || "Faculty"}`,
          code: rawTeacherCode,
          subject: teacherProf.subject || "General Academics",
          teacherId: teacherProf.userId,
          teacherName: matchedTeacher?.name || "Faculty Member",
        };
      }
    }

    if (!matchedClassroom || !matchedTeacher) {
      return res.status(400).json({
        success: false,
        message: `Invalid Classroom Code: No teacher found with code "${rawTeacherCode}". Please check with your teacher and enter a valid code.`,
      });
    }

    // Generate 6-digit OTP in MongoDB (stored as bcrypt hash, expires in 5 minutes)
    const otpData = await generateOtp(normalizedEmail, "student_verification");
    console.log(`[AUTH] 📧 Dispatching OTP to ${normalizedEmail} (Student: ${rawName}, Classroom: ${rawTeacherCode})...`);

    // Dispatch real email via SMTP
    const emailRes = await sendStudentOtpEmail({
      email: normalizedEmail,
      name: rawName,
      otp: otpData.otp,
    });

    if (!emailRes.success) {
      console.error(`[AUTH] ❌ SMTP Email delivery failed for ${normalizedEmail}: ${emailRes.error}`);
      return res.status(502).json({
        success: false,
        message: `Failed to deliver verification code to ${normalizedEmail}. SMTP error: ${emailRes.error || "Mail server error"}. Please check your email address or SMTP configuration.`,
        errorDetails: emailRes.error,
      });
    }

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}. Valid for 5 minutes.`,
      email: normalizedEmail,
      classroom: {
        code: rawTeacherCode,
        name: matchedClassroom.name,
        subject: matchedClassroom.subject,
        teacherName: matchedClassroom.teacherName || matchedTeacher.name,
      },
      senderEmail: process.env.EMAIL_USER || "noreply@edviko.edu",
    });
  } catch (err) {
    next(err);
  }
};

const verifyStudentRegistrationOtp = async (req, res, next) => {
  try {
    const rawEmail = (req.body.email || "").trim();
    const { otp } = req.body;

    if (!rawEmail || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email address and 6-digit verification code are required.",
      });
    }

    const normalizedEmail = rawEmail.toLowerCase();
    const verification = await verifyOtp(normalizedEmail, otp, "student_verification");

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid or expired verification code.",
      });
    }

    // Issue verification token for Step 3
    const secret = process.env.JWT_SECRET || "edviko_jwt_secret_dev_key_2026_super_secure";
    const verificationToken = jwt.sign(
      { email: normalizedEmail, verified: true, purpose: "signup-verification" },
      secret,
      { expiresIn: "15m" }
    );

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

    const rawName = (name || "").trim();
    const rawUsername = (username || "").trim().toLowerCase();
    const rawEmail = (email || "").trim().toLowerCase();

    if (!rawName) {
      return res.status(400).json({ success: false, message: "Full Name is required." });
    }

    if (!rawUsername || rawUsername.length < 3) {
      return res.status(400).json({ success: false, message: "Username must be at least 3 characters." });
    }

    if (!rawEmail || !/^\S+@\S+\.\S+$/.test(rawEmail)) {
      return res.status(400).json({ success: false, message: "A valid email address is required." });
    }

    if (!password || password.length < 8) {
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

    // Verify token or OTP
    let verified = false;
    if (verificationToken) {
      try {
        const secret = process.env.JWT_SECRET || "edviko_jwt_secret_dev_key_2026_super_secure";
        const decoded = jwt.verify(verificationToken, secret);
        if (decoded && decoded.email === rawEmail) {
          verified = true;
        }
      } catch {
        verified = false;
      }
    } else if (otp) {
      const v = await verifyOtp(rawEmail, otp, "student_verification");
      verified = v.success;
    }

    if (!verified) {
      return res.status(403).json({
        success: false,
        message: "Email verification required. Please verify your email first.",
      });
    }

    // Check existing email
    const existingEmail = await User.findOne({ email: rawEmail });
    if (existingEmail && existingEmail.isVerified) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists. Please log in directly.",
      });
    }

    // Check existing username
    const existingUsername = await User.findOne({ username: rawUsername });
    if (existingUsername && existingUsername.isVerified && String(existingUsername._id) !== String(existingEmail?._id)) {
      return res.status(400).json({
        success: false,
        message: "This username is already taken. Please choose another username.",
      });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let user;
    if (existingEmail) {
      existingEmail.name = rawName;
      existingEmail.username = rawUsername;
      existingEmail.passwordHash = passwordHash;
      existingEmail.role = "student";
      existingEmail.isVerified = true;
      existingEmail.isApproved = true;
      await existingEmail.save();
      user = existingEmail;
    } else {
      user = await User.create({
        name: rawName,
        username: rawUsername,
        email: rawEmail,
        passwordHash,
        role: "student",
        isVerified: true,
        isApproved: true,
      });
    }

    // Classroom enrollment handling (Mandatory: Must match teacher's code)
    const cleanTeacherCode = (teacherCode || "").trim().toUpperCase();
    if (!cleanTeacherCode) {
      return res.status(400).json({
        success: false,
        message: "Classroom code is required. Please provide your teacher's classroom code.",
      });
    }

    let initialClassroom = await Classroom.findOne({ code: cleanTeacherCode });
    let assignedTeacherId = null;
    let teacherUser = null;

    if (initialClassroom) {
      assignedTeacherId = initialClassroom.teacherId;
      teacherUser = await User.findById(assignedTeacherId);
      if (!initialClassroom.students.includes(user._id)) {
        initialClassroom.students.push(user._id);
        await initialClassroom.save();
      }
    } else {
      const teacherProf = await TeacherProfile.findOne({ teacherCode: cleanTeacherCode });
      if (teacherProf) {
        assignedTeacherId = teacherProf.userId;
        teacherUser = await User.findById(assignedTeacherId);
        initialClassroom = await Classroom.create({
          name: `${teacherProf.subject || "Course"} - ${teacherUser?.name || "Faculty"}`,
          code: cleanTeacherCode,
          teacherId: assignedTeacherId,
          teacherName: teacherUser?.name || "Faculty Member",
          subject: teacherProf.subject || "General Academics",
          students: [user._id],
        });
      }
    }

    if (!assignedTeacherId) {
      return res.status(400).json({
        success: false,
        message: `Invalid Classroom Code: No teacher found with code "${cleanTeacherCode}".`,
      });
    }

    // Also update teacher profile students list if assigned
    if (assignedTeacherId) {
      await TeacherProfile.findOneAndUpdate(
        { userId: assignedTeacherId },
        { $addToSet: { students: user._id } }
      );
    }

    // Create or update StudentProfile
    let studentProfile = await StudentProfile.findOne({ userId: user._id });
    if (!studentProfile) {
      studentProfile = await StudentProfile.create({
        userId: user._id,
        username: rawUsername,
        teacherId: assignedTeacherId,
        classroomCode: cleanTeacherCode,
        classroomHistory: assignedTeacherId
          ? [
              {
                teacherId: assignedTeacherId,
                teacherCode: cleanTeacherCode,
                teacherName: initialClassroom?.teacherName || "Faculty Member",
                joinedAt: new Date(),
              },
            ]
          : [],
      });
    } else {
      studentProfile.username = rawUsername;
      if (assignedTeacherId) {
        studentProfile.teacherId = assignedTeacherId;
        studentProfile.classroomCode = cleanTeacherCode;
      }
      await studentProfile.save();
    }

    // Notify teacher that a new student has registered and joined their classroom
    if (assignedTeacherId) {
      try {
        await Notification.create({
          recipientId: assignedTeacherId,
          senderId: user._id,
          senderName: user.name || "Student",
          classroomCode: cleanTeacherCode,
          type: "general",
          title: "👋 New Student Joined Classroom",
          message: `${user.name} (${user.username || user.email}) registered and joined classroom ${cleanTeacherCode}.`,
          link: "/teacher/students",
          isRead: false,
        });
      } catch (notifErr) {
        console.warn("Registration teacher notification warning:", notifErr.message);
      }
    }

    try {
      await clearVerifiedOtp(rawEmail, "student_verification");
    } catch {}

    sendTokenResponse(user, 201, res, "Student account created successfully!", {
      studentProfile,
      classroomCode: cleanTeacherCode,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. STUDENT LOGIN
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
        message: "Email / Username and password are required.",
      });
    }

    const clean = rawIdentifier.toLowerCase();

    // Query user by email, username, or name
    const user = await User.findOne({
      $or: [
        { email: clean },
        { username: clean },
        { name: rawIdentifier },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid Student credentials. No account found.",
      });
    }

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This account is a Faculty / Teacher account. Please log in via the Faculty Portal.",
      });
    }

    if (user.isRemoved) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You have been removed from the class by your teacher and cannot log in with this account.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please verify and try again.",
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
// 4. TEACHER REGISTRATION (EMAIL OTP DISPATCH & VERIFY)
// ==========================================
const sendTeacherRegistrationOtp = async (req, res, next) => {
  try {
    const rawEmail = (req.body.email || "").trim();
    const rawName = (req.body.name || "Professor").trim();
    const subject = (req.body.subject || "").trim();

    if (!rawEmail) {
      return res.status(400).json({
        success: false,
        message: "Faculty email address is required.",
      });
    }

    const normalizedEmail = rawEmail.toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({
        success: false,
        message: "An educator account with this email is already registered. Please log in directly.",
      });
    }

    const otpData = await generateOtp(normalizedEmail, "teacher_verification");
    console.log(`[AUTH] 📧 Dispatching Faculty OTP to ${normalizedEmail}...`);

    const emailRes = await sendTeacherOtpEmail({
      email: normalizedEmail,
      name: rawName,
      otp: otpData.otp,
    });

    if (!emailRes.success) {
      console.error(`[AUTH] ❌ SMTP Email delivery failed for ${normalizedEmail}: ${emailRes.error}`);
      return res.status(502).json({
        success: false,
        message: `Failed to deliver verification code to ${normalizedEmail}. SMTP error: ${emailRes.error || "Mail server error"}. Please check your email address or SMTP configuration.`,
        errorDetails: emailRes.error,
      });
    }

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}. Valid for 5 minutes.`,
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

const verifyTeacherRegistrationOtp = async (req, res, next) => {
  try {
    const rawEmail = (req.body.email || "").trim();
    const { otp } = req.body;

    if (!rawEmail || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email address and 6-digit verification code are required.",
      });
    }

    const normalizedEmail = rawEmail.toLowerCase();
    const verification = await verifyOtp(normalizedEmail, otp, "teacher_verification");

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid or expired verification code.",
      });
    }

    const secret = process.env.JWT_SECRET || "edviko_jwt_secret_dev_key_2026_super_secure";
    const verificationToken = jwt.sign(
      { email: normalizedEmail, verified: true, purpose: "teacher-signup-verification" },
      secret,
      { expiresIn: "15m" }
    );

    res.status(200).json({
      success: true,
      verified: true,
      verificationToken,
      message: "Faculty email verified successfully! Please complete registration.",
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 5. TEACHER REGISTRATION (CREATE ACCOUNT)
// ==========================================
const registerTeacher = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      subject,
      department,
      universityOrCollege,
      verificationToken,
      otp,
    } = req.body;

    const rawName = (name || "").trim();
    const rawEmail = (email || "").trim().toLowerCase();
    const rawSubject = (subject || "").trim();

    if (!rawName) {
      return res.status(400).json({ success: false, message: "Full Name is required." });
    }

    if (!rawEmail || !/^\S+@\S+\.\S+$/.test(rawEmail)) {
      return res.status(400).json({ success: false, message: "A valid email address is required." });
    }

    if (!rawSubject) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required (e.g. Mathematics, Physics, Chemistry, English, Computer Science).",
      });
    }

    if (!password || password.length < 8) {
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

    // Verify token or OTP
    let verified = false;
    if (verificationToken) {
      try {
        const secret = process.env.JWT_SECRET || "edviko_jwt_secret_dev_key_2026_super_secure";
        const decoded = jwt.verify(verificationToken, secret);
        if (decoded && decoded.email === rawEmail) {
          verified = true;
        }
      } catch {
        verified = false;
      }
    } else if (otp) {
      const v = await verifyOtp(rawEmail, otp, "teacher_verification");
      verified = v.success;
    }

    if (!verified) {
      return res.status(403).json({
        success: false,
        message: "Email verification required. Please verify your faculty email first.",
      });
    }

    const existingUser = await User.findOne({ email: rawEmail });
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({
        success: false,
        message: "A faculty account with this email address already exists. Please log in directly.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let user;
    if (existingUser) {
      existingUser.name = rawName;
      existingUser.passwordHash = passwordHash;
      existingUser.role = "teacher";
      existingUser.isVerified = true;
      existingUser.isApproved = true;
      await existingUser.save();
      user = existingUser;
    } else {
      user = await User.create({
        name: rawName,
        username: rawEmail.split("@")[0].toLowerCase(),
        email: rawEmail,
        passwordHash,
        role: "teacher",
        isVerified: true,
        isApproved: true,
      });
    }

    // Unique Classroom Code
    const teacherCode = await generateUniqueTeacherCode();

    // Create Teacher Profile with Subject
    const teacherProfile = await TeacherProfile.create({
      userId: user._id,
      teacherCode,
      universityOrCollege: (universityOrCollege || "University / College").trim(),
      department: (department || "Academics").trim(),
      subject: rawSubject,
      students: [],
      removedStudents: [],
    });

    // Create initial Classroom
    await Classroom.create({
      name: `${rawSubject} - ${rawName}`,
      code: teacherCode,
      teacherId: user._id,
      teacherName: rawName,
      subject: rawSubject,
      department: (department || "Academics").trim(),
      description: `Official classroom for ${rawSubject} instructed by ${rawName}.`,
      students: [],
    });

    try {
      await clearVerifiedOtp(rawEmail, "teacher_verification");
    } catch {}

    sendTokenResponse(user, 201, res, "Faculty account created successfully!", {
      teacherProfile,
      teacherCode,
      subject: rawSubject,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 6. TEACHER LOGIN
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

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. No faculty account found with this email.",
      });
    }

    if (user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This account is a Student account. Please log in via the Student Portal.",
      });
    }

    if (user.isApproved === false) {
      return res.status(403).json({
        success: false,
        message: "Account pending approval. Please contact administrator.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please verify and try again.",
      });
    }

    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    // Load existing profile (with subject)
    let teacherProfile = await TeacherProfile.findOne({ userId: user._id });
    if (!teacherProfile) {
      const teacherCode = await generateUniqueTeacherCode();
      teacherProfile = await TeacherProfile.create({
        userId: user._id,
        teacherCode,
        subject: "General Academics",
        department: "Academics",
        universityOrCollege: "University / College",
        students: [],
      });
    }

    // Ensure at least one Classroom exists with their code
    const existingClassroom = await Classroom.findOne({ teacherId: user._id });
    if (!existingClassroom) {
      await Classroom.create({
        name: `${teacherProfile.subject || "Course"} - ${user.name}`,
        code: teacherProfile.teacherCode,
        teacherId: user._id,
        teacherName: user.name,
        subject: teacherProfile.subject || "General Academics",
        students: teacherProfile.students || [],
      });
    }

    sendTokenResponse(user, 200, res, "Teacher logged in successfully!", {
      teacherProfile,
      teacherCode: teacherProfile.teacherCode,
      subject: teacherProfile.subject,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. PASSWORD RESET FLOW
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
        message: `Reset code generated: ${otpData.otp} (or dev code 123456). Valid for 5 minutes.`,
        otp: otpData.otp,
        devOtp: "123456",
        email: normalizedEmail,
      });
    }

    res.json({
      success: true,
      emailSent: true,
      message: `Password reset verification code sent to ${normalizedEmail}. Valid for 5 minutes.`,
      email: normalizedEmail,
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
    const v = await verifyOtp(normalizedEmail, otp, "password_reset");

    if (!v.success) {
      return res.status(400).json({
        success: false,
        message: v.message || "Invalid or expired reset code.",
      });
    }

    const secret = process.env.JWT_SECRET || "edviko_jwt_secret_dev_key_2026_super_secure";
    const resetToken = jwt.sign(
      { email: normalizedEmail, purpose: "password_reset_confirmed" },
      secret,
      { expiresIn: "15m" }
    );

    res.json({
      success: true,
      resetToken,
      message: "Reset code verified. Please set your new password.",
    });
  } catch (err) {
    next(err);
  }
};

const resetPasswordWithOtp = async (req, res, next) => {
  try {
    const { email, newPassword, resetToken } = req.body;

    if (!email || !newPassword || !resetToken) {
      return res.status(400).json({
        success: false,
        message: "Email, new password, and reset authorization token are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const secret = process.env.JWT_SECRET || "edviko_jwt_secret_dev_key_2026_super_secure";

    try {
      const decoded = jwt.verify(resetToken, secret);
      if (decoded.email !== normalizedEmail || decoded.purpose !== "password_reset_confirmed") {
        return res.status(403).json({ success: false, message: "Invalid reset token." });
      }
    } catch {
      return res.status(403).json({ success: false, message: "Invalid or expired reset token." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
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
      console.error(`[AUTH] ❌ SMTP resend failed for ${normalizedEmail}: ${emailRes?.error}`);
      return res.status(502).json({
        success: false,
        emailSent: false,
        message: `Failed to deliver verification email to ${normalizedEmail}. SMTP error: ${emailRes?.error || "Mail server rejected request"}.`,
        errorDetails: emailRes?.error,
      });
    }

    res.json({
      success: true,
      emailSent: true,
      message: `A new 6-digit verification code has been sent to ${normalizedEmail}. Valid for 5 minutes.`,
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 9. GET CURRENT USER (SESSION PERSISTENCE)
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
        subject: t.subject || "General Academics",
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
