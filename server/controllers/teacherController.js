const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");
const StudentProfile = require("../models/StudentProfile");
const Document = require("../models/Document");
const AIResult = require("../models/AIResult");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");

/**
 * Helper to fetch assigned student IDs for this teacher
 */
const getAssignedStudentIds = async (teacherUserId) => {
  const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
  const profiles = await StudentProfile.find({ teacherId: teacherUserId });
  const idsFromProfiles = profiles.map((p) => p.userId);
  const idsFromTeacher = teacherProfile ? teacherProfile.students : [];

  const combined = Array.from(
    new Set([...idsFromProfiles.map(String), ...idsFromTeacher.map(String)])
  );
  return combined;
};

/**
 * Teacher Dashboard Statistics
 */
const getTeacherDashboard = async (req, res, next) => {
  try {
    const teacherUserId = req.user._id;
    const studentIds = await getAssignedStudentIds(teacherUserId);

    const totalStudents = studentIds.length;
    const totalDocuments = await Document.countDocuments({
      studentId: { $in: studentIds },
    });

    const attempts = await QuizAttempt.find({
      studentId: { $in: studentIds },
    })
      .populate("studentId", "name email")
      .populate("documentId", "title")
      .sort({ completedAt: -1 })
      .lean();

    const totalQuizAttempts = attempts.length;
    let scoreSum = 0;
    attempts.forEach((a) => {
      scoreSum += a.percentage;
    });

    const averageStudentScore = totalQuizAttempts > 0
      ? Math.round(scoreSum / totalQuizAttempts)
      : 0;

    // Recent activity feed
    const recentActivity = attempts.slice(0, 8).map((a) => ({
      id: a._id,
      type: "quiz_attempt",
      studentName: a.studentId?.name || "Student",
      studentEmail: a.studentId?.email,
      documentTitle: a.documentId?.title || "Study Material",
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.percentage,
      timestamp: a.completedAt,
    }));

    const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });

    res.json({
      success: true,
      stats: {
        totalStudents,
        totalDocuments,
        totalQuizAttempts,
        averageStudentScore,
      },
      teacherProfile: {
        teacherCode: teacherProfile?.teacherCode,
        department: teacherProfile?.department,
      },
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List Assigned Students
 */
const getAssignedStudents = async (req, res, next) => {
  try {
    const studentIds = await getAssignedStudentIds(req.user._id);

    const students = await User.find({ _id: { $in: studentIds } })
      .select("name email createdAt isVerified")
      .lean();

    const studentDocs = await Document.find({ studentId: { $in: studentIds } }).lean();
    const studentAttempts = await QuizAttempt.find({ studentId: { $in: studentIds } }).lean();

    const enriched = students.map((s) => {
      const myDocs = studentDocs.filter((d) => d.studentId.toString() === s._id.toString());
      const myAttempts = studentAttempts.filter(
        (a) => a.studentId.toString() === s._id.toString()
      );

      const totalAttempts = myAttempts.length;
      const avgScore = totalAttempts > 0
        ? Math.round(myAttempts.reduce((acc, a) => acc + a.percentage, 0) / totalAttempts)
        : 0;

      const lastAttempt = myAttempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
      const lastDoc = myDocs.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))[0];

      let lastActivityDate = null;
      if (lastAttempt && lastDoc) {
        lastActivityDate = new Date(lastAttempt.completedAt) > new Date(lastDoc.uploadDate)
          ? lastAttempt.completedAt
          : lastDoc.uploadDate;
      } else if (lastAttempt) {
        lastActivityDate = lastAttempt.completedAt;
      } else if (lastDoc) {
        lastActivityDate = lastDoc.uploadDate;
      }

      return {
        id: s._id,
        name: s.name,
        email: s.email,
        totalDocuments: myDocs.length,
        totalQuizAttempts: totalAttempts,
        averageScore: avgScore,
        lastActivity: lastActivityDate,
        isVerified: s.isVerified,
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      students: enriched,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Specific Student Details (Teacher must be assigned to this student)
 */
const getStudentDetails = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const assignedIds = await getAssignedStudentIds(req.user._id);

    if (!assignedIds.includes(studentId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This student is not assigned to your classes.",
      });
    }

    const student = await User.findById(studentId).select("name email createdAt isVerified");
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const profile = await StudentProfile.findOne({ userId: studentId });
    const documents = await Document.find({ studentId }).sort({ createdAt: -1 }).lean();
    const attempts = await QuizAttempt.find({ studentId })
      .populate("documentId", "title")
      .sort({ completedAt: -1 })
      .lean();

    const docIds = documents.map((d) => d._id);
    const aiResults = await AIResult.find({ documentId: { $in: docIds } }).lean();

    const enrichedDocs = documents.map((doc) => {
      const ai = aiResults.find((a) => a.documentId.toString() === doc._id.toString());
      return {
        id: doc._id,
        title: doc.title,
        originalFileName: doc.originalFileName,
        fileType: doc.fileType,
        wordCount: doc.wordCount,
        uploadDate: doc.uploadDate,
        hasSummary: Boolean(ai?.summary),
        hasNotes: Boolean(ai?.importantNotes || ai?.quickNotes),
        hasQuestions: Boolean(ai?.questions?.length > 0),
      };
    });

    const totalAttempts = attempts.length;
    const avgScore = totalAttempts > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.percentage, 0) / totalAttempts)
      : 0;

    res.json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        createdAt: student.createdAt,
        gradeOrClass: profile?.gradeOrClass || "College / University",
        bio: profile?.bio || "",
      },
      stats: {
        totalDocuments: documents.length,
        totalQuizAttempts: totalAttempts,
        averageScore: avgScore,
      },
      documents: enrichedDocs,
      quizResults: attempts.map((a) => ({
        id: a._id,
        documentTitle: a.documentId?.title || "Study Material",
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: a.percentage,
        completedAt: a.completedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Student Quiz Results Detailed Breakdown
 */
const getStudentQuizResults = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const assignedIds = await getAssignedStudentIds(req.user._id);

    if (!assignedIds.includes(studentId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Student is not assigned to your classes.",
      });
    }

    const attempts = await QuizAttempt.find({ studentId })
      .populate("documentId", "title")
      .populate("quizId")
      .sort({ completedAt: -1 });

    res.json({
      success: true,
      count: attempts.length,
      attempts,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get All Documents Across Assigned Students
 */
const getAllAssignedDocuments = async (req, res, next) => {
  try {
    const studentIds = await getAssignedStudentIds(req.user._id);

    const documents = await Document.find({ studentId: { $in: studentIds } })
      .populate("studentId", "name email")
      .sort({ uploadDate: -1 })
      .lean();

    const docIds = documents.map((d) => d._id);
    const [aiResults, quizzes, quizAttempts] = await Promise.all([
      AIResult.find({ documentId: { $in: docIds } }).lean(),
      Quiz.find({ documentId: { $in: docIds } }).lean(),
      QuizAttempt.find({ documentId: { $in: docIds } }).lean(),
    ]);

    const enriched = documents.map((doc) => {
      const ai = aiResults.find((a) => a.documentId.toString() === doc._id.toString());
      const quiz = quizzes.find((q) => q.documentId.toString() === doc._id.toString());
      const attempts = quizAttempts.filter((qa) => qa.documentId.toString() === doc._id.toString());
      const latestAttempt = attempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

      return {
        id: doc._id,
        title: doc.title,
        originalFileName: doc.originalFileName,
        fileType: doc.fileType,
        wordCount: doc.wordCount,
        uploadDate: doc.uploadDate,
        student: {
          id: doc.studentId?._id || doc.studentId,
          name: doc.studentId?.name || "Student",
          email: doc.studentId?.email || "",
        },
        hasSummary: Boolean(ai?.summary),
        hasNotes: Boolean(ai?.importantNotes || ai?.quickNotes),
        hasQuestions: Boolean(ai?.questions?.length > 0),
        hasQuiz: Boolean(quiz?.questions?.length > 0),
        attemptsCount: attempts.length,
        latestScore: latestAttempt
          ? {
              score: latestAttempt.score,
              totalQuestions: latestAttempt.totalQuestions,
              percentage: latestAttempt.percentage,
              completedAt: latestAttempt.completedAt,
            }
          : null,
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      documents: enriched,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get All Quiz Results Across Assigned Students
 */
const getAllAssignedQuizResults = async (req, res, next) => {
  try {
    const studentIds = await getAssignedStudentIds(req.user._id);

    const attempts = await QuizAttempt.find({ studentId: { $in: studentIds } })
      .populate("studentId", "name email")
      .populate("documentId", "title")
      .sort({ completedAt: -1 })
      .lean();

    const formatted = attempts.map((a) => ({
      id: a._id,
      student: {
        id: a.studentId?._id || a.studentId,
        name: a.studentId?.name || "Student",
        email: a.studentId?.email || "",
      },
      documentTitle: a.documentId?.title || "Study Material",
      documentId: a.documentId?._id || a.documentId,
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.percentage,
      completedAt: a.completedAt,
    }));

    res.json({
      success: true,
      count: formatted.length,
      quizResults: formatted,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTeacherDashboard,
  getAssignedStudents,
  getStudentDetails,
  getStudentQuizResults,
  getAllAssignedDocuments,
  getAllAssignedQuizResults,
};
