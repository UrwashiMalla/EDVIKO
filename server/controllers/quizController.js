const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const Document = require("../models/Document");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const Notification = require("../models/Notification");
const groqService = require("../services/groqService");
const { getValidLanguage } = require("../utils/languageHelper");

/**
 * Helper: Find assigned teacher ID and classroom code for a student
 */
const getStudentClassroomInfo = async (studentUserId) => {
  const profile = await StudentProfile.findOne({ userId: studentUserId });
  let teacherId = profile ? profile.teacherId : null;
  let classroomCode = "";

  if (!teacherId) {
    // Check if any teacher profile contains this student
    const teacherWithStudent = await TeacherProfile.findOne({ students: studentUserId });
    if (teacherWithStudent) {
      teacherId = teacherWithStudent.userId;
      classroomCode = teacherWithStudent.teacherCode;
    } else {
      // Auto-fallback to default teacher if available
      const defaultTeacher = await TeacherProfile.findOne();
      if (defaultTeacher) {
        teacherId = defaultTeacher.userId;
        classroomCode = defaultTeacher.teacherCode;
      }
    }
  } else {
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId });
    if (teacherProfile) {
      classroomCode = teacherProfile.teacherCode;
    }
  }

  return { teacherId, classroomCode, profile };
};

/**
 * Helper: Get all classroom students for a teacher
 */
const getClassroomStudents = async (teacherUserId) => {
  const teacherProfile = await TeacherProfile.findOne({ userId: teacherUserId });
  const enrolledProfiles = await StudentProfile.find({ teacherId: teacherUserId }).populate("userId", "name email");

  const allClassStudents = [];
  const seenStdIds = new Set();

  enrolledProfiles.forEach((ep) => {
    if (ep.userId && !seenStdIds.has(String(ep.userId._id))) {
      seenStdIds.add(String(ep.userId._id));
      allClassStudents.push({
        id: ep.userId._id,
        name: ep.userId.name,
        email: ep.userId.email,
      });
    }
  });

  if (teacherProfile && teacherProfile.students) {
    const extraStudents = await User.find({ _id: { $in: teacherProfile.students } }).select("name email").lean();
    extraStudents.forEach((st) => {
      if (!seenStdIds.has(String(st._id))) {
        seenStdIds.add(String(st._id));
        allClassStudents.push({
          id: st._id,
          name: st.name,
          email: st.email,
        });
      }
    });
  }

  // Also include any unassigned students who are not assigned to other teachers
  const otherTeacherProfiles = await TeacherProfile.find({ userId: { $ne: teacherUserId } });
  const otherTeacherUserIds = otherTeacherProfiles.map((tp) => tp.userId);
  const otherStudentProfiles = await StudentProfile.find({ teacherId: { $in: otherTeacherUserIds } });
  const otherStudentUserIds = new Set(otherStudentProfiles.map((sp) => String(sp.userId)));

  const unassignedStudents = await User.find({
    role: "student",
    isRemoved: { $ne: true },
    _id: { $nin: Array.from(otherStudentUserIds) },
  }).select("name email").lean();

  unassignedStudents.forEach((st) => {
    if (!seenStdIds.has(String(st._id))) {
      seenStdIds.add(String(st._id));
      allClassStudents.push({
        id: st._id,
        name: st.name,
        email: st.email,
      });
    }
  });

  return allClassStudents;
};

/**
 * Helper: Build comprehensive student roster mapped against quiz attempts
 */
const buildStudentRoster = (allClassStudents, attempts, questionCount, passingScore = 60) => {
  const rosterMap = new Map();

  // Initialize unattempted records for all enrolled students
  allClassStudents.forEach((std) => {
    rosterMap.set(String(std.id), {
      studentId: std.id,
      name: std.name,
      email: std.email,
      attempted: false,
      score: 0,
      marks: 0,
      totalMarks: questionCount,
      totalQuestions: questionCount,
      correctCount: 0,
      wrongCount: 0,
      unattemptedCount: questionCount,
      percentage: 0,
      passed: false,
      completedAt: null,
      attemptId: null,
      answers: [],
    });
  });

  // Overlay actual attempts
  attempts.forEach((a) => {
    const stdId = String(a.studentId?._id || a.studentId);
    if (!stdId) return;

    const stdName = a.studentId?.name || rosterMap.get(stdId)?.name || "Student";
    const stdEmail = a.studentId?.email || rosterMap.get(stdId)?.email || "";

    rosterMap.set(stdId, {
      studentId: stdId,
      name: stdName,
      email: stdEmail,
      attempted: true,
      score: a.percentage,
      marks: a.score,
      totalMarks: a.totalQuestions,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount !== undefined ? a.correctCount : a.score,
      wrongCount: a.wrongCount !== undefined ? a.wrongCount : (a.totalQuestions - a.score),
      unattemptedCount: a.unattemptedCount || 0,
      percentage: a.percentage,
      passed: a.passed !== undefined ? a.passed : (a.percentage >= passingScore),
      completedAt: a.completedAt ? new Date(a.completedAt).toLocaleString() : null,
      attemptId: a._id,
      answers: a.answers || [],
    });
  });

  return Array.from(rosterMap.values());
};

/**
 * Helper: Strip correct answers and explanations for secure student transmission
 */
const sanitizeQuizForStudent = (quiz, isAttempted = false) => {
  const qObj = quiz.toObject ? quiz.toObject() : { ...quiz };
  if (!isAttempted) {
    qObj.questions = (qObj.questions || []).map((q, idx) => ({
      index: idx,
      question: q.question,
      options: q.options,
    }));
  }
  return qObj;
};

/**
 * 1. Generate AI Quiz Preview for Teacher
 * Supports 1 to 30 questions with strict validation & diverse question generation
 */
const generateAiQuizPreview = async (req, res, next) => {
  try {
    const { text, documentId, language = "English", difficulty = "Medium" } = req.body;
    let rawCount = req.body.questionCount !== undefined ? req.body.questionCount : 10;

    // Validate question count: Min 1, Max 30
    const count = parseInt(rawCount, 10);
    if (isNaN(count) || count < 1 || count > 30) {
      return res.status(400).json({
        success: false,
        message: "Question count must be a number between 1 and 30.",
      });
    }

    let studyText = text ? text.trim() : "";
    if (!studyText && documentId) {
      const doc = await Document.findById(documentId);
      if (doc) {
        studyText = doc.extractedText;
      }
    }

    if (!studyText || studyText.length < 20) {
      return res.status(400).json({
        success: false,
        message: "Sufficient study text or document content is required to generate a quiz.",
      });
    }

    const validLang = getValidLanguage(language);
    const questions = await groqService.generateQuiz(
      studyText,
      validLang,
      true, // fresh generation
      count,
      difficulty
    );

    res.json({
      success: true,
      count: questions.length,
      language: validLang,
      difficulty,
      questions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Publish Quiz (AI or Manual) to Teacher's Classroom
 * Saves to MongoDB, links to teacher & classroom, and notifies enrolled students
 */
const publishQuiz = async (req, res, next) => {
  try {
    const {
      title,
      description = "",
      subject = "General",
      timeLimit = null,
      passingScore = 60,
      difficulty = "Medium",
      questions = [],
      documentId = null,
      language = "English",
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Quiz title is required.",
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one quiz question is required.",
      });
    }

    if (questions.length > 30) {
      return res.status(400).json({
        success: false,
        message: "A quiz cannot have more than 30 questions.",
      });
    }

    // Validate each question: 4 options and exactly one valid correctAnswer (0..3)
    const sanitizedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.question.trim()) {
        return res.status(400).json({
          success: false,
          message: `Question #${i + 1} is missing question text.`,
        });
      }

      if (!Array.isArray(q.options) || q.options.length !== 4) {
        return res.status(400).json({
          success: false,
          message: `Question #${i + 1} must have exactly 4 options.`,
        });
      }

      for (let j = 0; j < 4; j++) {
        if (!q.options[j] || !String(q.options[j]).trim()) {
          return res.status(400).json({
            success: false,
            message: `Question #${i + 1}, Option ${j + 1} cannot be empty.`,
          });
        }
      }

      const corr = parseInt(q.correctAnswer, 10);
      if (isNaN(corr) || corr < 0 || corr > 3) {
        return res.status(400).json({
          success: false,
          message: `Question #${i + 1} must have a valid correct answer option selected (0, 1, 2, or 3).`,
        });
      }

      sanitizedQuestions.push({
        question: q.question.trim(),
        options: q.options.map((opt) => String(opt).trim()),
        correctAnswer: corr,
        explanation: q.explanation ? String(q.explanation).trim() : "",
      });
    }

    // Get Teacher Classroom Information
    let classroomCode = "CLASS-101";
    let teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      // Create teacher profile if missing
      teacherProfile = await TeacherProfile.create({
        userId: req.user._id,
        teacherCode: `TEACH-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        department: subject || "Academics",
        students: [],
      });
    }
    classroomCode = teacherProfile.teacherCode;

    // Create Quiz in MongoDB
    const quiz = await Quiz.create({
      teacherId: req.user._id,
      classroomCode,
      title: title.trim(),
      description: description.trim(),
      subject: subject.trim(),
      timeLimit: timeLimit !== null && timeLimit !== undefined && Number(timeLimit) > 0 ? Number(timeLimit) : null,
      passingScore: Number(passingScore) || 60,
      difficulty,
      questions: sanitizedQuestions,
      documentId: documentId || null,
      language: getValidLanguage(language),
      isPublished: true,
      createdBy: "teacher",
    });

    // Notify all students in this teacher's classroom
    try {
      const enrolledStudents = await StudentProfile.find({ teacherId: req.user._id });
      const studentUserIds = new Set();
      enrolledStudents.forEach((s) => {
        if (s.userId && mongoose.Types.ObjectId.isValid(s.userId)) {
          studentUserIds.add(String(s.userId));
        }
      });
      if (teacherProfile.students && Array.isArray(teacherProfile.students)) {
        teacherProfile.students.forEach((sId) => {
          if (sId && mongoose.Types.ObjectId.isValid(sId)) {
            studentUserIds.add(String(sId));
          }
        });
      }

      const notificationsToCreate = Array.from(studentUserIds).map((sUserId) => ({
        recipientId: sUserId,
        senderId: req.user._id,
        senderName: req.user.name || "Faculty Instructor",
        classroomCode,
        type: "quiz",
        title: `🎯 New Quiz Published: ${quiz.title}`,
        message: `Your instructor published a new ${sanitizedQuestions.length}-question quiz: "${quiz.title}". Attempt it now to test your knowledge!`,
        link: "/student/quizzes",
        quizId: quiz._id,
        isRead: false,
      }));

      if (notificationsToCreate.length > 0) {
        await Notification.insertMany(notificationsToCreate);
      }
    } catch (notifErr) {
      console.warn("Quiz notification non-blocking warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Quiz published successfully to your classroom!",
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        subject: quiz.subject,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        difficulty: quiz.difficulty,
        questionCount: sanitizedQuestions.length,
        classroomCode: quiz.classroomCode,
        createdAt: quiz.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. List Quizzes (Classroom-Scoped)
 * Teachers see their published quizzes + attempts summary.
 * Students ONLY see published quizzes from their assigned teacher's classroom.
 * Security: Correct answers and explanations are stripped for students.
 */
const listQuizzes = async (req, res, next) => {
  try {
    const isTeacher = req.user.role === "teacher";

    if (isTeacher) {
      // Find all quizzes authored by this teacher
      const quizzes = await Quiz.find({ teacherId: req.user._id }).sort({ createdAt: -1 }).lean();
      const quizIds = quizzes.map((q) => q._id);
      const attempts = await QuizAttempt.find({ quizId: { $in: quizIds } })
        .populate("studentId", "name email")
        .sort({ completedAt: -1 })
        .lean();

      // Find all students enrolled in this teacher's classroom
      const allClassStudents = await getClassroomStudents(req.user._id);

      const enriched = quizzes.map((q) => {
        const qAttempts = attempts.filter((a) => String(a.quizId) === String(q._id));
        const roster = buildStudentRoster(allClassStudents, qAttempts, q.questions.length, q.passingScore);

        return {
          id: q._id,
          title: q.title,
          description: q.description,
          subject: q.subject,
          timeLimit: q.timeLimit,
          passingScore: q.passingScore,
          difficulty: q.difficulty,
          questionCount: q.questions.length,
          classroomCode: q.classroomCode,
          createdAt: q.createdAt,
          totalAttempts: qAttempts.length,
          questions: q.questions, // Teacher can see questions with answers
          studentRoster: roster,
        };
      });

      return res.json({
        success: true,
        count: enriched.length,
        quizzes: enriched,
      });
    }

    // STUDENT: Only access quizzes from student's registered classroom
    const { teacherId, classroomCode } = await getStudentClassroomInfo(req.user._id);

    if (!teacherId) {
      return res.json({
        success: true,
        count: 0,
        quizzes: [],
        message: "You are not enrolled in any teacher's classroom yet.",
      });
    }

    const quizzes = await Quiz.find({
      teacherId,
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const quizIds = quizzes.map((q) => q._id);
    const myAttempts = await QuizAttempt.find({
      quizId: { $in: quizIds },
      studentId: req.user._id,
    })
      .sort({ completedAt: -1 })
      .lean();

    // Map sanitized quizzes for student (strip correct answers & explanations)
    const sanitizedQuizzes = quizzes.map((q) => {
      const myAttempt = myAttempts.find((a) => String(a.quizId) === String(q._id));
      const hasAttempted = Boolean(myAttempt);

      return {
        id: q._id,
        title: q.title,
        description: q.description,
        subject: q.subject,
        timeLimit: q.timeLimit,
        passingScore: q.passingScore,
        difficulty: q.difficulty,
        questionCount: q.questions.length,
        classroomCode: q.classroomCode,
        createdAt: q.createdAt,
        hasAttempted,
        attempt: myAttempt
          ? {
              attemptId: myAttempt._id,
              score: myAttempt.score,
              totalQuestions: myAttempt.totalQuestions,
              correctCount: myAttempt.correctCount,
              wrongCount: myAttempt.wrongCount,
              unattemptedCount: myAttempt.unattemptedCount,
              percentage: myAttempt.percentage,
              passed: myAttempt.passed,
              completedAt: myAttempt.completedAt,
              answers: myAttempt.answers,
            }
          : null,
        // Security requirement: Strip correct answers from questions
        questions: q.questions.map((item, idx) => ({
          questionIndex: idx,
          question: item.question,
          options: item.options,
        })),
      };
    });

    res.json({
      success: true,
      count: sanitizedQuizzes.length,
      quizzes: sanitizedQuizzes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Get Quiz By ID
 * Security: Strict classroom isolation check.
 * Security: Strip correct answers if student hasn't completed attempt.
 */
const getQuizById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found.",
      });
    }

    const isTeacher = req.user.role === "teacher";

    if (isTeacher) {
      // Teacher authorization: must be quiz author or departmental mentor
      if (quiz.teacherId && !quiz.teacherId.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "Access Denied: You do not own this quiz.",
        });
      }

      return res.json({
        success: true,
        quiz,
      });
    }

    // STUDENT: Enforce classroom isolation
    const { teacherId } = await getStudentClassroomInfo(req.user._id);

    if (!teacherId || !quiz.teacherId || !quiz.teacherId.equals(teacherId)) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: This quiz belongs to a different classroom.",
      });
    }

    // Check if student has already completed the quiz
    const existingAttempt = await QuizAttempt.findOne({
      quizId: quiz._id,
      studentId: req.user._id,
    }).sort({ completedAt: -1 });

    if (existingAttempt) {
      // Student already completed: show questions with attempt results and explanations
      return res.json({
        success: true,
        quiz: {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          subject: quiz.subject,
          timeLimit: quiz.timeLimit,
          passingScore: quiz.passingScore,
          difficulty: quiz.difficulty,
          questionCount: quiz.questions.length,
          classroomCode: quiz.classroomCode,
          hasAttempted: true,
          attempt: existingAttempt,
          questions: quiz.questions, // Can show answers post-completion
        },
      });
    }

    // Unattempted: Strip answers securely
    const sanitized = sanitizeQuizForStudent(quiz, false);

    res.json({
      success: true,
      quiz: {
        id: sanitized._id,
        title: sanitized.title,
        description: sanitized.description,
        subject: sanitized.subject,
        timeLimit: sanitized.timeLimit,
        passingScore: sanitized.passingScore,
        difficulty: sanitized.difficulty,
        questionCount: sanitized.questions.length,
        classroomCode: sanitized.classroomCode,
        hasAttempted: false,
        questions: sanitized.questions,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. Submit Quiz Attempt & Secure Backend Answer Evaluation
 * Fixes quiz answer evaluation bug completely:
 * - Compares student selected answer against real correctAnswer stored in MongoDB.
 * - Categorizes each question as "Correct", "Wrong", or "Not Attempted".
 * - Accurately calculates total marks, correct answers, wrong answers, unattempted questions, percentage.
 * - Stores attempt securely in MongoDB.
 * - Returns student's selected answer alongside the correct answer and explanation for all questions.
 */
const submitQuizAttempt = async (req, res, next) => {
  try {
    const { id: quizId } = req.params;
    const { answers } = req.body; // Can be object { [qIdx]: selectedOptionIdx } or array of { questionIndex, selectedAnswer }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found.",
      });
    }

    // Verify student belongs to this teacher's classroom
    const { teacherId } = await getStudentClassroomInfo(req.user._id);
    if (quiz.teacherId && (!teacherId || !quiz.teacherId.equals(teacherId))) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: You do not belong to this teacher's classroom.",
      });
    }

    // Normalize incoming answers map
    const answerMap = {};
    if (answers && typeof answers === "object") {
      if (Array.isArray(answers)) {
        answers.forEach((ans) => {
          if (ans && ans.questionIndex !== undefined) {
            answerMap[ans.questionIndex] = ans.selectedAnswer;
          }
        });
      } else {
        Object.keys(answers).forEach((key) => {
          answerMap[key] = answers[key];
        });
      }
    }

    const totalQuestions = quiz.questions.length;
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    const evaluatedAnswers = quiz.questions.map((q, idx) => {
      const rawSelected = answerMap[idx] !== undefined ? answerMap[idx] : -1;
      let selectedAnswer = -1;

      if (rawSelected !== null && rawSelected !== undefined && rawSelected !== -1 && rawSelected !== "") {
        const parsed = parseInt(rawSelected, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 3) {
          selectedAnswer = parsed;
        }
      }

      const correctAnswer = q.correctAnswer;
      let status = "Not Attempted";
      let isCorrect = false;

      if (selectedAnswer === -1) {
        status = "Not Attempted";
        isCorrect = false;
        unattemptedCount++;
      } else if (selectedAnswer === correctAnswer) {
        status = "Correct";
        isCorrect = true;
        correctCount++;
      } else {
        status = "Wrong";
        isCorrect = false;
        wrongCount++;
      }

      return {
        questionIndex: idx,
        question: q.question,
        options: q.options,
        selectedAnswer,
        correctAnswer,
        isCorrect,
        status, // "Correct" | "Wrong" | "Not Attempted"
        explanation: q.explanation || "Verified directly from study curriculum.",
      };
    });

    const score = correctCount; // Total marks
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = percentage >= (quiz.passingScore || 60);

    // Save Attempt in MongoDB
    const attempt = await QuizAttempt.create({
      quizId: quiz._id,
      documentId: quiz.documentId || null,
      studentId: req.user._id,
      teacherId: quiz.teacherId || null,
      classroomCode: quiz.classroomCode || "",
      answers: evaluatedAnswers,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      unattemptedCount,
      percentage,
      passed,
      completedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Quiz submitted and evaluated successfully.",
      result: {
        attemptId: attempt._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        score,
        totalQuestions,
        correctCount,
        wrongCount,
        unattemptedCount,
        percentage,
        passed,
        passingScore: quiz.passingScore || 60,
        completedAt: attempt.completedAt,
        answers: evaluatedAnswers,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. Delete Quiz
 */
const deleteQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findOne({ _id: id, teacherId: req.user._id });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found or unauthorized to delete.",
      });
    }

    await Quiz.deleteOne({ _id: id });
    await QuizAttempt.deleteMany({ quizId: id });
    await Notification.deleteMany({ quizId: id });

    res.json({
      success: true,
      message: "Quiz and related submissions deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. Get Quiz Submissions for Teacher Analytics
 */
const getQuizSubmissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findOne({ _id: id, teacherId: req.user._id });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found.",
      });
    }

    const attempts = await QuizAttempt.find({ quizId: id })
      .populate("studentId", "name email")
      .sort({ completedAt: -1 })
      .lean();

    const allClassStudents = await getClassroomStudents(req.user._id);
    const studentRoster = buildStudentRoster(allClassStudents, attempts, quiz.questions.length, quiz.passingScore);

    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        questionCount: quiz.questions.length,
        passingScore: quiz.passingScore,
      },
      count: attempts.length,
      attempts: attempts.map((a) => ({
        id: a._id,
        student: {
          id: a.studentId?._id || a.studentId,
          name: a.studentId?.name || "Student",
          email: a.studentId?.email || "",
        },
        score: a.score,
        totalQuestions: a.totalQuestions,
        correctCount: a.correctCount,
        wrongCount: a.wrongCount,
        unattemptedCount: a.unattemptedCount,
        percentage: a.percentage,
        passed: a.passed,
        completedAt: a.completedAt,
        answers: a.answers,
      })),
      studentRoster,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. Backward Compatibility: Get Quiz by Document ID (for student study materials)
 */
const getQuizByDocumentId = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const query = { documentId };
    if (req.query.lang || req.query.language) {
      query.language = getValidLanguage(req.query.lang || req.query.language);
    }
    const quiz = await Quiz.findOne(query);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "No quiz generated yet for this document.",
      });
    }

    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        documentId: quiz.documentId,
        language: quiz.language,
        questions: quiz.questions,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 9. Backward Compatibility: Get Attempts
 */
const getAttempts = async (req, res, next) => {
  try {
    const { id: quizId } = req.params;
    let filter = { quizId };
    if (req.user.role === "student") {
      filter.studentId = req.user._id;
    }

    const attempts = await QuizAttempt.find(filter).sort({ completedAt: -1 });

    res.json({
      success: true,
      count: attempts.length,
      attempts,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generateAiQuizPreview,
  publishQuiz,
  listQuizzes,
  getQuizById,
  submitQuizAttempt,
  deleteQuiz,
  getQuizSubmissions,
  getQuizByDocumentId,
  getAttempts,
};
