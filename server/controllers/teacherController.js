const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");
const StudentProfile = require("../models/StudentProfile");
const Document = require("../models/Document");
const AIResult = require("../models/AIResult");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const Classroom = require("../models/Classroom");
const Lecture = require("../models/Lecture");
const Note = require("../models/Note");
const { generateUniqueTeacherCode } = require("../utils/codeGenerator");

/**
 * Helper to fetch assigned active student IDs for this teacher
 */
const getAssignedStudentIds = async (teacherUserId) => {
  const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
  if (!teacherProfile) return [];

  const removedIds = new Set(
    (teacherProfile.removedStudents || [])
      .filter((r) => r.studentId)
      .map((r) => r.studentId.toString())
  );

  const idSet = new Set();

  // 1. From TeacherProfile.students
  (teacherProfile.students || []).forEach((id) => {
    if (id) idSet.add(id.toString());
  });

  // 2. From Classrooms owned by this teacher
  const classrooms = await Classroom.find({ teacherId: teacherUserId }).select("students");
  classrooms.forEach((cls) => {
    (cls.students || []).forEach((sId) => {
      if (sId) idSet.add(sId.toString());
    });
  });

  // 3. From StudentProfile enrolled in this teacher's classroom code or teacherId
  const studentProfiles = await StudentProfile.find({
    $or: [
      { teacherId: teacherUserId },
      { classroomCode: teacherProfile.teacherCode },
    ],
  }).select("userId");

  studentProfiles.forEach((sp) => {
    if (sp.userId) idSet.add(sp.userId.toString());
  });

  return Array.from(idSet).filter((id) => !removedIds.has(id));
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
      .populate("studentId", "name email username")
      .populate("documentId", "title")
      .populate("quizId", "title")
      .sort({ completedAt: -1 })
      .lean();

    const totalQuizAttempts = attempts.length;
    let scoreSum = 0;
    attempts.forEach((a) => {
      scoreSum += a.percentage || 0;
    });

    const averageStudentScore = totalQuizAttempts > 0
      ? Math.round(scoreSum / totalQuizAttempts)
      : 0;

    // Recent activity feed
    const recentActivity = attempts.slice(0, 8).map((a) => ({
      id: a._id,
      type: "quiz_attempt",
      studentName: a.studentId?.name || a.studentId?.username || "Student",
      studentEmail: a.studentId?.email,
      documentTitle: a.quizId?.title || a.documentId?.title || "Class Material",
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
        subject: teacherProfile?.subject,
        universityOrCollege: teacherProfile?.universityOrCollege,
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
      .select("name username email createdAt isVerified")
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
        ? Math.round(myAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0) / totalAttempts)
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
        username: s.username,
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
        message: "Access denied. This student is not enrolled in your classroom.",
      });
    }

    const student = await User.findById(studentId).select("name username email createdAt isVerified");
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
      .populate("quizId", "title")
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
      ? Math.round(attempts.reduce((acc, a) => acc + (a.percentage || 0), 0) / totalAttempts)
      : 0;

    res.json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        username: student.username,
        email: student.email,
        createdAt: student.createdAt,
        gradeOrClass: profile?.gradeOrClass || "College / University",
        classroomCode: profile?.classroomCode || "",
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
        documentTitle: a.quizId?.title || a.documentId?.title || "Class Quiz",
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
        message: "Access denied. Student is not enrolled in your classroom.",
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
      .populate("studentId", "name username email")
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
          name: doc.studentId?.name || doc.studentId?.username || "Student",
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
      .populate("studentId", "name username email")
      .populate("documentId", "title")
      .populate("quizId", "title")
      .sort({ completedAt: -1 })
      .lean();

    const formatted = attempts.map((a) => ({
      id: a._id,
      student: {
        id: a.studentId?._id || a.studentId,
        name: a.studentId?.name || a.studentId?.username || "Student",
        email: a.studentId?.email || "",
      },
      documentTitle: a.quizId?.title || a.documentId?.title || "Class Quiz",
      documentId: a.documentId?._id || a.documentId,
      score: a.score,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      unattemptedCount: a.unattemptedCount,
      percentage: a.percentage,
      passed: a.passed,
      completedAt: a.completedAt,
      answers: a.answers,
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

/**
 * Teacher removes student from classroom
 * Preserves student account and learning history, but blocks rejoining with code
 */
const removeStudentFromClass = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const teacherUserId = req.user._id;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found.",
      });
    }

    // Remove from active students array
    teacherProfile.students = teacherProfile.students.filter(
      (id) => id.toString() !== studentId.toString()
    );

    // Add to removedStudents list if not already present
    const alreadyRemoved = (teacherProfile.removedStudents || []).some(
      (r) => r.studentId && r.studentId.toString() === studentId.toString()
    );

    if (!alreadyRemoved) {
      teacherProfile.removedStudents.push({
        studentId: student._id,
        email: student.email,
        name: student.name || student.username,
        removedAt: new Date(),
        reason: "Removed by instructor from classroom",
      });
    }

    await teacherProfile.save();

    // Detach teacher from student's active profile, closing history session
    const studentProfile = await StudentProfile.findOne({ userId: studentId });
    if (studentProfile && studentProfile.teacherId && studentProfile.teacherId.toString() === teacherUserId.toString()) {
      if (studentProfile.classroomHistory && studentProfile.classroomHistory.length > 0) {
        const last = studentProfile.classroomHistory[studentProfile.classroomHistory.length - 1];
        if (!last.leftAt) last.leftAt = new Date();
      }
      studentProfile.teacherId = null;
      studentProfile.classroomCode = "";
      await studentProfile.save();
    }

    res.json({
      success: true,
      message: `Student "${student.name || student.username}" (${student.email}) removed from your classroom. Their learning records remain preserved, but they cannot rejoin using your classroom code.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher unremoves student from classroom
 * Restores ability for student to rejoin classroom with teacher code
 */
const unremoveStudentFromClass = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const teacherUserId = req.user._id;

    const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found.",
      });
    }

    const initialCount = (teacherProfile.removedStudents || []).length;
    teacherProfile.removedStudents = (teacherProfile.removedStudents || []).filter(
      (r) =>
        r.studentId?.toString() !== studentId.toString() &&
        r._id?.toString() !== studentId.toString()
    );

    await teacherProfile.save();

    res.json({
      success: true,
      message: "Student unremoved successfully! They are now permitted to rejoin your classroom using your classroom code.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Removed Students List
 */
const getRemovedStudents = async (req, res, next) => {
  try {
    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    const list = teacherProfile?.removedStudents || [];

    res.json({
      success: true,
      removedStudents: list.map((r) => ({
        id: r.studentId || r._id,
        name: r.name,
        email: r.email,
        removedAt: r.removedAt,
        reason: r.reason,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher sends broadcast announcement to all active students in classroom
 */
const sendBroadcast = async (req, res, next) => {
  try {
    const { title, content, priority = "Normal", tag = "Announcement" } = req.body;

    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Announcement title and content are required.",
      });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    const classroomCode = teacherProfile?.teacherCode || "EDVIKO-CLASS";

    const broadcast = await Message.create({
      senderId: req.user._id,
      senderName: req.user.name || "Faculty Instructor",
      senderRole: "teacher",
      recipientId: null,
      recipientName: "All Students",
      classroomCode,
      isBroadcast: true,
      title: title.trim(),
      text: content.trim(),
      priority,
      tag,
    });

    // Notify ALL active students in this teacher's classroom
    try {
      const studentIds = await getAssignedStudentIds(req.user._id);
      if (studentIds.length > 0) {
        const notifs = studentIds.map((sId) => ({
          recipientId: sId,
          senderId: req.user._id,
          senderName: req.user.name || "Faculty Instructor",
          classroomCode,
          type: "announcement",
          title: `📢 New Class Announcement: ${title.trim()}`,
          message: content.trim().slice(0, 140),
          link: "/student/dashboard",
          isRead: false,
        }));
        await Notification.insertMany(notifs);
      }
    } catch (notifErr) {
      console.warn("Broadcast notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Announcement broadcast successfully to all enrolled students!",
      broadcast,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher gets all broadcasts sent
 */
const getBroadcasts = async (req, res, next) => {
  try {
    const broadcasts = await Message.find({
      senderId: req.user._id,
      isBroadcast: true,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      broadcasts,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher sends personal direct message to a particular student
 */
const sendDirectMessage = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.body.studentId;
    const text = req.body.text || req.body.message;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Target student ID is required.",
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message text cannot be empty.",
      });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found.",
      });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    const classroomCode = teacherProfile?.teacherCode || "";

    const msg = await Message.create({
      senderId: req.user._id,
      senderName: req.user.name || "Faculty Instructor",
      senderRole: "teacher",
      recipientId: student._id,
      recipientName: student.name || student.username || "Student",
      classroomCode,
      isBroadcast: false,
      text: text.trim(),
    });

    // Notify the recipient student in MongoDB
    try {
      await Notification.create({
        recipientId: student._id,
        senderId: req.user._id,
        senderName: req.user.name || "Faculty Instructor",
        classroomCode,
        type: "message",
        title: `💬 New Message from ${req.user.name || "Professor"}`,
        message: text.trim().slice(0, 140),
        link: "/student/dashboard",
        isRead: false,
      });
    } catch (notifErr) {
      console.warn("Teacher to student notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Message delivered to ${student.name || student.username}!`,
      directMessage: msg,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher gets conversation history with a particular student
 */
const getStudentDirectMessages = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const messages = await Message.find({
      isBroadcast: false,
      $or: [
        { senderId: req.user._id, recipientId: studentId },
        { senderId: studentId, recipientId: req.user._id },
      ],
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      messages,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher gets list of conversation threads with students
 */
const getConversationsList = async (req, res, next) => {
  try {
    const teacherId = req.user._id;

    // Find all distinct students involved in messages with this teacher
    const messages = await Message.find({
      isBroadcast: false,
      $or: [{ senderId: teacherId }, { recipientId: teacherId }],
    }).sort({ createdAt: -1 });

    const studentMap = new Map();
    for (const m of messages) {
      const otherId = m.senderId.toString() === teacherId.toString()
        ? m.recipientId.toString()
        : m.senderId.toString();

      if (!studentMap.has(otherId)) {
        studentMap.set(otherId, {
          studentId: otherId,
          lastMessage: m.text,
          lastSenderRole: m.senderRole,
          timestamp: m.createdAt,
        });
      }
    }

    // Also include any currently enrolled students without messages yet
    const assignedIds = await getAssignedStudentIds(teacherId);
    for (const sId of assignedIds) {
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          studentId: sId,
          lastMessage: "No messages yet",
          lastSenderRole: "",
          timestamp: null,
        });
      }
    }

    const studentUserIds = Array.from(studentMap.keys());
    const users = await User.find({ _id: { $in: studentUserIds } }).select("name username email");

    const result = users.map((u) => {
      const thread = studentMap.get(u._id.toString());
      return {
        studentId: u._id,
        name: u.name,
        username: u.username,
        email: u.email,
        lastMessage: thread?.lastMessage || "",
        lastSenderRole: thread?.lastSenderRole || "",
        timestamp: thread?.timestamp || null,
      };
    });

    res.json({
      success: true,
      conversations: result,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Teacher creates a new classroom with custom name & subject
 */
const createTeacherClassroom = async (req, res, next) => {
  try {
    const { name, subject, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Classroom name is required." });
    }

    const teacherUserId = req.user._id;
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
    const code = await generateUniqueTeacherCode();

    const classroom = await Classroom.create({
      name: name.trim(),
      code,
      teacherId: teacherUserId,
      teacherName: req.user.name || "Faculty Instructor",
      subject: (subject || teacherProfile?.subject || "General Academics").trim(),
      description: (description || "").trim(),
      students: [],
    });

    res.status(201).json({
      success: true,
      message: `Classroom "${classroom.name}" created with code: ${code}`,
      classroom,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher manually regenerates code for a classroom if explicitly requested
 */
const regenerateClassroomCode = async (req, res, next) => {
  try {
    const { classroomId } = req.body;
    const teacherUserId = req.user._id;
    const newCode = await generateUniqueTeacherCode();

    let classroom;
    if (classroomId) {
      classroom = await Classroom.findOne({ _id: classroomId, teacherId: teacherUserId });
    } else {
      classroom = await Classroom.findOne({ teacherId: teacherUserId }).sort({ createdAt: -1 });
    }

    if (!classroom) {
      // Create if none exists
      const prof = await TeacherProfile.findOne({ userId: teacherUserId });
      classroom = await Classroom.create({
        name: `${prof?.subject || "Course"} - ${req.user.name}`,
        code: newCode,
        teacherId: teacherUserId,
        teacherName: req.user.name,
        subject: prof?.subject || "General Academics",
        students: [],
      });
    } else {
      classroom.code = newCode;
      await classroom.save();
    }

    // Also update main profile teacherCode so it stays in sync
    await TeacherProfile.findOneAndUpdate(
      { userId: teacherUserId },
      { teacherCode: newCode }
    );

    res.json({
      success: true,
      message: `Classroom code updated to ${newCode}`,
      code: newCode,
      classroom,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all classrooms created by this teacher
 */
const getTeacherClassrooms = async (req, res, next) => {
  try {
    const teacherUserId = req.user._id;
    let classrooms = await Classroom.find({ teacherId: teacherUserId })
      .populate("students", "name email username")
      .sort({ createdAt: -1 });

    if (classrooms.length === 0) {
      const prof = await TeacherProfile.findOne({ userId: teacherUserId });
      if (prof) {
        const defaultClass = await Classroom.create({
          name: `${prof.subject || "Course"} - ${req.user.name}`,
          code: prof.teacherCode,
          teacherId: teacherUserId,
          teacherName: req.user.name,
          subject: prof.subject || "General Academics",
          students: prof.students || [],
        });
        classrooms = [defaultClass];
      }
    }

    res.json({
      success: true,
      classrooms,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher uploads / publishes a lecture
 */
const createLecture = async (req, res, next) => {
  try {
    const { title, subject, duration, videoEmbedUrl, description, takeaways, content, classroomCode } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Lecture title is required." });
    }

    const teacherUserId = req.user._id;
    let targetClassCode = (classroomCode || "").trim().toUpperCase();

    if (!targetClassCode) {
      const tp = await TeacherProfile.findOne({ userId: teacherUserId });
      targetClassCode = tp?.teacherCode || "EDVIKO-CLASS";
    }

    let parsedTakeaways = [];
    if (takeaways) {
      if (Array.isArray(takeaways)) {
        parsedTakeaways = takeaways.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof takeaways === "string") {
        parsedTakeaways = takeaways.split("\n").map((t) => t.trim()).filter(Boolean);
      }
    }

    let cleanUrl = (videoEmbedUrl || "").trim();
    if (cleanUrl.includes("watch?v=")) {
      cleanUrl = cleanUrl.replace("watch?v=", "embed/");
    }

    const lecture = await Lecture.create({
      title: title.trim(),
      subject: (subject || "General").trim(),
      classroomCode: targetClassCode,
      teacherId: teacherUserId,
      teacherName: req.user.name || "Faculty Instructor",
      duration: (duration || "45 min").trim(),
      videoEmbedUrl: cleanUrl,
      description: (description || "").trim(),
      takeaways: parsedTakeaways,
      content: (content || "").trim(),
    });

    try {
      const studentIds = await getAssignedStudentIds(teacherUserId);
      if (studentIds.length > 0) {
        const notifs = studentIds.map((sId) => ({
          recipientId: sId,
          senderId: teacherUserId,
          senderName: req.user.name || "Faculty Instructor",
          classroomCode: targetClassCode,
          type: "lecture",
          title: `🎥 New Lecture: ${title.trim()}`,
          message: `Your instructor published a new lecture: "${title.trim()}" (${lecture.duration}).`,
          link: "/student/lectures-notes",
          isRead: false,
        }));
        await Notification.insertMany(notifs);
      }
    } catch (notifErr) {
      console.warn("Lecture notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Lecture uploaded and published to classroom students successfully!",
      lecture,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all lectures authored by this teacher
 */
const getTeacherLectures = async (req, res, next) => {
  try {
    const { classroomCode } = req.query;
    const filter = { teacherId: req.user._id };
    if (classroomCode) {
      filter.classroomCode = classroomCode.trim().toUpperCase();
    }

    const lectures = await Lecture.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: lectures.length,
      lectures,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a lecture authored by this teacher
 */
const deleteLecture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lecture = await Lecture.findOneAndDelete({ _id: id, teacherId: req.user._id });

    if (!lecture) {
      return res.status(404).json({ success: false, message: "Lecture not found or unauthorized." });
    }

    res.json({
      success: true,
      message: "Lecture deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Teacher uploads / publishes study notes
 */
const createNote = async (req, res, next) => {
  try {
    const { title, subject, module, description, content, fileName, fileSize, pages, classroomCode } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Note title is required." });
    }

    const noteContent = (content || description || "").trim();
    if (!noteContent) {
      return res.status(400).json({ success: false, message: "Note content or description is required." });
    }

    const teacherUserId = req.user._id;
    let targetClassCode = (classroomCode || "").trim().toUpperCase();

    if (!targetClassCode) {
      const tp = await TeacherProfile.findOne({ userId: teacherUserId });
      targetClassCode = tp?.teacherCode || "EDVIKO-CLASS";
    }

    let docRecord = null;
    try {
      docRecord = await Document.create({
        studentId: teacherUserId,
        teacherId: teacherUserId,
        isTeacherMaterial: true,
        title: title.trim(),
        extractedText: noteContent,
        originalFileName: fileName || `${title.trim().replace(/\s+/g, "_")}.txt`,
        fileType: "text",
        wordCount: noteContent.split(/\s+/).length,
      });
    } catch (docErr) {
      console.warn("Document auto-creation notice:", docErr.message);
    }

    const note = await Note.create({
      title: title.trim(),
      subject: (subject || "General").trim(),
      module: (module || "General Curriculum").trim(),
      classroomCode: targetClassCode,
      teacherId: teacherUserId,
      teacherName: req.user.name || "Faculty Instructor",
      fileSize: (fileSize || "1.2 MB").trim(),
      pages: (pages || "Handout").trim(),
      description: (description || "").trim(),
      content: noteContent,
      fileName: (fileName || `${title.trim()}.txt`).trim(),
      fileUrl: "",
      documentId: docRecord ? docRecord._id : null,
    });

    try {
      const studentIds = await getAssignedStudentIds(teacherUserId);
      if (studentIds.length > 0) {
        const notifs = studentIds.map((sId) => ({
          recipientId: sId,
          senderId: teacherUserId,
          senderName: req.user.name || "Faculty Instructor",
          classroomCode: targetClassCode,
          type: "note",
          title: `📄 New Study Notes: ${title.trim()}`,
          message: `Your instructor published new notes on "${title.trim()}" for ${note.subject}.`,
          link: "/student/lectures-notes",
          isRead: false,
        }));
        await Notification.insertMany(notifs);
      }
    } catch (notifErr) {
      console.warn("Note notification warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Study note published to classroom students successfully!",
      note,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all notes authored by this teacher
 */
const getTeacherNotes = async (req, res, next) => {
  try {
    const { classroomCode } = req.query;
    const filter = { teacherId: req.user._id };
    if (classroomCode) {
      filter.classroomCode = classroomCode.trim().toUpperCase();
    }

    const notes = await Note.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a note authored by this teacher
 */
const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const note = await Note.findOneAndDelete({ _id: id, teacherId: req.user._id });

    if (!note) {
      return res.status(404).json({ success: false, message: "Note not found or unauthorized." });
    }

    if (note.documentId) {
      await Document.findByIdAndDelete(note.documentId).catch(() => {});
    }

    res.json({
      success: true,
      message: "Note deleted successfully.",
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
  removeStudentFromClass,
  unremoveStudentFromClass,
  getRemovedStudents,
  sendBroadcast,
  getBroadcasts,
  sendDirectMessage,
  getStudentDirectMessages,
  getConversationsList,
  createTeacherClassroom,
  regenerateClassroomCode,
  getTeacherClassrooms,
  createLecture,
  getTeacherLectures,
  deleteLecture,
  createNote,
  getTeacherNotes,
  deleteNote,
};
