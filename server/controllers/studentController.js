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

    // Student profile with teacher
    const profile = await StudentProfile.findOne({ userId: studentId }).populate(
      "teacherId",
      "name email"
    );

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
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { gradeOrClass, bio, teacherCode } = req.body;
    let profile = await StudentProfile.findOne({ userId: req.user._id });

    if (!profile) {
      profile = new StudentProfile({ userId: req.user._id });
    }

    if (gradeOrClass !== undefined) profile.gradeOrClass = gradeOrClass;
    if (bio !== undefined) profile.bio = bio;

    if (teacherCode && teacherCode.trim()) {
      const teacher = await TeacherProfile.findOne({
        teacherCode: teacherCode.trim().toUpperCase(),
      });
      if (teacher) {
        profile.teacherId = teacher.userId;
        teacher.students.addToSet(req.user._id);
        await teacher.save();
      }
    }

    await profile.save();

    res.json({
      success: true,
      message: "Profile updated successfully.",
      profile,
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
    let teacherUserId = studentProfile ? studentProfile.teacherId : null;

    let query = { isBroadcast: true };
    if (teacherUserId) {
      const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
      const classroomCode = teacherProfile ? teacherProfile.teacherCode : null;
      if (classroomCode) {
        query = {
          isBroadcast: true,
          $or: [{ senderId: teacherUserId }, { classroomCode }],
        };
      } else {
        query = { isBroadcast: true, senderId: teacherUserId };
      }
    }

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
 * Get direct messages between student and teacher
 */
const getDirectMessagesWithTeacher = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    let teacherUserId = studentProfile ? studentProfile.teacherId : null;

    if (!teacherUserId) {
      const defaultTeacher = await TeacherProfile.findOne();
      if (defaultTeacher) {
        teacherUserId = defaultTeacher.userId;
      }
    }

    let messages = [];
    if (teacherUserId) {
      messages = await Message.find({
        isBroadcast: false,
        $or: [
          { senderId: req.user._id, recipientId: teacherUserId },
          { senderId: teacherUserId, recipientId: req.user._id },
        ],
      }).sort({ createdAt: 1 });
    }

    res.json({
      success: true,
      messages,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Student sends direct message to teacher
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
    let teacherUserId = studentProfile ? studentProfile.teacherId : null;

    if (!teacherUserId) {
      const defaultTeacher = await TeacherProfile.findOne();
      if (defaultTeacher) {
        teacherUserId = defaultTeacher.userId;
      }
    }

    if (!teacherUserId) {
      return res.status(400).json({
        success: false,
        message: "No assigned teacher found for this student.",
      });
    }

    const teacherUser = await User.findById(teacherUserId);

    const msg = await Message.create({
      senderId: req.user._id,
      senderName: req.user.name || "Student",
      senderRole: "student",
      recipientId: teacherUserId,
      recipientName: teacherUser ? teacherUser.name : "Professor",
      isBroadcast: false,
      text: text.trim(),
    });

    // Create Notification for the teacher
    try {
      await Notification.create({
        recipientId: teacherUserId,
        senderId: req.user._id,
        senderName: req.user.name || "Student",
        type: "message",
        title: `💬 New Message from ${req.user.name || "Student"}`,
        message: text.trim(),
        link: "/teacher/dashboard",
        isRead: false,
      });
    } catch (notifErr) {
      console.warn("Student to teacher DM notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Direct message delivered to faculty!",
      directMessage: msg,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  updateProfile,
  getClassroomBroadcasts,
  getDirectMessagesWithTeacher,
  sendDirectMessageToTeacher,
};
