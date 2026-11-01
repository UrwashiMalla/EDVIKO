const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const QuizAttempt = require("../models/QuizAttempt");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

/**
 * Get Student Dashboard Data (Statistics, Enrolled Teacher, Quizzes)
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const studentUser = await User.findById(req.user._id).select("name username email role avatar");

    // Fetch student profile and populate current teacher
    let profile = await StudentProfile.findOne({ userId: req.user._id }).populate(
      "teacherId",
      "name email"
    );

    if (!profile) {
      profile = await StudentProfile.create({
        userId: req.user._id,
        username: studentUser.username || studentUser.name,
      });
    }

    // Find teacher details
    let activeTeacherProfile = null;
    if (profile.teacherId) {
      activeTeacherProfile = await TeacherProfile.findOne({
        userId: profile.teacherId._id,
      });
    }

    // Fetch quiz attempts history
    const quizAttempts = await QuizAttempt.find({ studentId: req.user._id })
      .populate("quizId", "title topic")
      .populate("documentId", "title")
      .sort({ completedAt: -1 });

    const totalQuizzesAttempted = quizAttempts.length;
    const averageScore =
      totalQuizzesAttempted > 0
        ? Math.round(
            quizAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) /
              totalQuizzesAttempted
          )
        : 0;

    res.json({
      success: true,
      user: studentUser,
      stats: {
        totalQuizzesAttempted,
        averageScore,
        enrolledTeacherName: profile.teacherId?.name || "Not Assigned",
        enrolledTeacherEmail: profile.teacherId?.email || "",
        classroomCode: profile.classroomCode || activeTeacherProfile?.teacherCode || "N/A",
      },
      recentAttempts: quizAttempts.slice(0, 10).map((att) => ({
        id: att._id,
        quizTitle: att.quizId?.title || "Quiz",
        documentTitle: att.documentId?.title || "Study Material",
        score: att.score,
        totalQuestions: att.totalQuestions,
        percentage: att.percentage,
        completedAt: att.completedAt,
      })),
      profile,
      activeTeacherProfile,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Profile (Student Name, Grade, Bio, Avatar)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, gradeOrClass, bio, avatar } = req.body;
    let profile = await StudentProfile.findOne({ userId: req.user._id });

    if (!profile) {
      profile = new StudentProfile({ userId: req.user._id });
    }

    if (gradeOrClass !== undefined) profile.gradeOrClass = gradeOrClass;
    if (bio !== undefined) profile.bio = bio;
    if (avatar !== undefined) profile.avatar = avatar;

    await profile.save();

    // Update User name and avatar if provided
    const userUpdates = {};
    if (name && name.trim()) userUpdates.name = name.trim();
    if (avatar !== undefined) userUpdates.avatar = avatar;

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(req.user._id, userUpdates);
    }

    const updatedUser = await User.findById(req.user._id).select("name username email role avatar");

    // Re-populate teacher info for frontend
    await profile.populate("teacherId", "name email");

    res.json({
      success: true,
      message: "Profile updated successfully.",
      profile,
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Change Classroom / Teacher
 * Preserves all previous activity, marks, notes, quizzes, and appends to classroomHistory.
 */
const changeClassroom = async (req, res, next) => {
  try {
    const { teacherCode } = req.body;

    if (!teacherCode || !teacherCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "New teacher classroom code is required.",
      });
    }

    const cleanCode = teacherCode.trim().toUpperCase();
    const newTeacherProfile = await TeacherProfile.findOne({
      teacherCode: cleanCode,
    }).populate("userId", "name email");

    if (!newTeacherProfile || !newTeacherProfile.userId) {
      return res.status(404).json({
        success: false,
        message: `Classroom code "${cleanCode}" not found. Please verify with your instructor.`,
      });
    }

    const studentUser = await User.findById(req.user._id);

    // Verify student is not in this teacher's removed list
    const isRemoved = (newTeacherProfile.removedStudents || []).some(
      (r) =>
        (r.email && r.email.toLowerCase() === studentUser.email.toLowerCase()) ||
        (r.studentId && r.studentId.toString() === studentUser._id.toString())
    );

    if (isRemoved) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You have been removed from this teacher's classroom and cannot rejoin.",
      });
    }

    let studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    if (!studentProfile) {
      studentProfile = new StudentProfile({ userId: req.user._id });
    }

    // Check if already in this classroom
    if (
      studentProfile.teacherId &&
      studentProfile.teacherId.toString() === newTeacherProfile.userId._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this teacher's classroom.",
      });
    }

    // Preserve previous classroom in history
    if (studentProfile.teacherId) {
      // Remove from previous teacher's active students list
      await TeacherProfile.findOneAndUpdate(
        { userId: studentProfile.teacherId },
        { $pull: { students: studentUser._id } }
      );

      // Close previous history session
      if (studentProfile.classroomHistory && studentProfile.classroomHistory.length > 0) {
        const lastEntry = studentProfile.classroomHistory[studentProfile.classroomHistory.length - 1];
        if (!lastEntry.leftAt) {
          lastEntry.leftAt = new Date();
        }
      }
    }

    // Add to new teacher's students list
    newTeacherProfile.students.addToSet(studentUser._id);
    await newTeacherProfile.save();

    // Append new history entry
    studentProfile.classroomHistory.push({
      teacherId: newTeacherProfile.userId._id,
      teacherCode: cleanCode,
      teacherName: newTeacherProfile.userId.name || "Faculty Member",
      joinedAt: new Date(),
    });

    studentProfile.teacherId = newTeacherProfile.userId._id;
    studentProfile.classroomCode = cleanCode;
    await studentProfile.save();

    // Notify new teacher
    try {
      await Notification.create({
        recipientId: newTeacherProfile.userId._id,
        senderId: studentUser._id,
        senderName: studentUser.name || "Student",
        classroomCode: cleanCode,
        type: "general",
        title: "👋 New Student Joined Classroom",
        message: `${studentUser.name} (${studentUser.username || studentUser.email}) joined your classroom.`,
        link: "/teacher/students",
      });
    } catch (notifErr) {
      console.warn("Classroom change notification warning:", notifErr.message);
    }

    const populatedProfile = await StudentProfile.findOne({ userId: req.user._id }).populate(
      "teacherId",
      "name email"
    );

    res.json({
      success: true,
      message: `Successfully joined ${newTeacherProfile.userId.name}'s classroom (${cleanCode})! All your previous learning records have been preserved.`,
      profile: populatedProfile,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all group broadcasts for this student's assigned classroom
 */
const getClassroomBroadcasts = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });

    if (!studentProfile || !studentProfile.classroomCode) {
      return res.json({
        success: true,
        broadcasts: [],
      });
    }

    const broadcasts = await Message.find({
      classroomCode: studentProfile.classroomCode,
      isBroadcast: true,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      broadcasts,
      classroomCode: studentProfile.classroomCode,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get direct messages between student and their assigned teacher
 */
const getDirectMessagesWithTeacher = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    const teacherUserId = studentProfile ? studentProfile.teacherId : null;

    let filter = {
      isBroadcast: false,
      $or: [
        { senderId: req.user._id },
        { recipientId: req.user._id },
      ],
    };

    if (teacherUserId) {
      filter = {
        isBroadcast: false,
        $or: [
          { senderId: req.user._id, recipientId: teacherUserId },
          { senderId: teacherUserId, recipientId: req.user._id },
          { recipientId: req.user._id },
          { senderId: req.user._id },
        ],
      };
    }

    const messages = await Message.find(filter).sort({ createdAt: 1 });

    res.json({
      success: true,
      messages,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Student sends personal 1-on-1 message to their assigned teacher
 */
const sendDirectMessageToTeacher = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message text cannot be empty.",
      });
    }

    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    const teacherUserId = studentProfile ? studentProfile.teacherId : null;

    if (!teacherUserId) {
      return res.status(400).json({
        success: false,
        message: "No assigned teacher found. Please connect to a classroom first.",
      });
    }

    const teacherUser = await User.findById(teacherUserId);
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });

    const msg = await Message.create({
      senderId: req.user._id,
      senderName: req.user.name || "Student",
      senderRole: "student",
      recipientId: teacherUserId,
      recipientName: teacherUser ? teacherUser.name : "Faculty Mentor",
      classroomCode: teacherProfile?.teacherCode || "",
      isBroadcast: false,
      text: text.trim(),
    });

    // Notify teacher
    try {
      await Notification.create({
        recipientId: teacherUserId,
        senderId: req.user._id,
        senderName: req.user.name || "Student",
        classroomCode: teacherProfile?.teacherCode || "",
        type: "general",
        title: "💬 New Personal Message from Student",
        message: `${req.user.name}: "${text.trim().slice(0, 70)}${text.trim().length > 70 ? "..." : ""}"`,
        link: `/teacher/messages`,
      });
    } catch (notifErr) {
      console.warn("Personal message notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: msg,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  updateProfile,
  changeClassroom,
  getClassroomBroadcasts,
  getDirectMessagesWithTeacher,
  sendDirectMessageToTeacher,
};
