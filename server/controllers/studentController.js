const Document = require("../models/Document");
const QuizAttempt = require("../models/QuizAttempt");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const AIResult = require("../models/AIResult");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");

/**
 * Get Student Dashboard Real Statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    // Total documents
    const totalDocs = await Document.countDocuments({ studentId });

    // Quiz attempts
    const attempts = await QuizAttempt.find({ studentId })
      .populate("documentId", "title")
      .sort({ completedAt: -1 })
      .lean();

    const totalQuizzesAttempted = attempts.length;
    let totalScoreSum = 0;
    let totalQuestionsCount = 0;
    let totalCorrectCount = 0;

    attempts.forEach((att) => {
      totalScoreSum += att.percentage;
      totalCorrectCount += att.score;
      totalQuestionsCount += att.totalQuestions || 10;
    });

    const averageScore = totalQuizzesAttempted > 0
      ? Math.round(totalScoreSum / totalQuizzesAttempted)
      : 0;

    // Recent documents
    const recentDocuments = await Document.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title originalFileName fileType wordCount uploadDate")
      .lean();

    // Student profile with active teacher details
    const profile = await StudentProfile.findOne({ userId: studentId }).populate(
      "teacherId",
      "name email"
    );

    let activeTeacherProfile = null;
    if (profile && profile.teacherId) {
      activeTeacherProfile = await TeacherProfile.findOne({
        userId: profile.teacherId._id,
      }).select("teacherCode universityOrCollege department subject");
    }

    res.json({
      success: true,
      stats: {
        totalDocuments: totalDocs,
        totalQuizzesAttempted,
        averageScore,
        totalQuestionsCompleted: totalQuestionsCount,
        totalCorrectAnswers: totalCorrectCount,
      },
      recentDocuments: recentDocuments.map((d) => ({
        id: d._id,
        title: d.title,
        originalFileName: d.originalFileName,
        fileType: d.fileType,
        wordCount: d.wordCount,
        uploadDate: d.uploadDate,
      })),
      recentQuizResults: attempts.slice(0, 5).map((att) => ({
        id: att._id,
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
 * Update Profile (Student Name, Grade, Bio)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, gradeOrClass, bio } = req.body;
    let profile = await StudentProfile.findOne({ userId: req.user._id });

    if (!profile) {
      profile = new StudentProfile({ userId: req.user._id });
    }

    if (gradeOrClass !== undefined) profile.gradeOrClass = gradeOrClass;
    if (bio !== undefined) profile.bio = bio;
    await profile.save();

    if (name && name.trim()) {
      await User.findByIdAndUpdate(req.user._id, { name: name.trim() });
    }

    const updatedUser = await User.findById(req.user._id).select("name username email role");

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
 * Get classroom broadcasts / announcements for student
 */
const getClassroomBroadcasts = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    const teacherUserId = studentProfile ? studentProfile.teacherId : null;

    if (!teacherUserId) {
      return res.json({ success: true, broadcasts: [] });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
    const classroomCode = teacherProfile ? teacherProfile.teacherCode : null;

    const query = {
      isBroadcast: true,
      $or: [
        { senderId: teacherUserId },
        ...(classroomCode ? [{ classroomCode }] : []),
      ],
    };

    const broadcasts = await Message.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      broadcasts,
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

    // Create Notification for the teacher
    try {
      await Notification.create({
        recipientId: teacherUserId,
        senderId: req.user._id,
        senderName: req.user.name || "Student",
        classroomCode: teacherProfile?.teacherCode || "",
        type: "message",
        title: `💬 New Personal Message from ${req.user.name || "Student"}`,
        message: text.trim().slice(0, 120),
        link: "/teacher/dashboard",
        isRead: false,
      });
    } catch (notifErr) {
      console.warn("Student to teacher notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Personal message delivered to your teacher!",
      directMessage: msg,
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
