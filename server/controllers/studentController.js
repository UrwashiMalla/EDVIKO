const Document = require("../models/Document");
const QuizAttempt = require("../models/QuizAttempt");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const AIResult = require("../models/AIResult");

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

module.exports = {
  getDashboardStats,
  updateProfile,
};
