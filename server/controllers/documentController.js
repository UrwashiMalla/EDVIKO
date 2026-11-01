const Document = require("../models/Document");
const AIResult = require("../models/AIResult");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const TutorChat = require("../models/TutorChat");
const StudentProfile = require("../models/StudentProfile");
const { validateDocumentContent, getStats } = require("../services/documentService");
const { getValidLanguage } = require("../utils/languageHelper");

/**
 * Upload / Save Extracted Document
 */
const createDocument = async (req, res, next) => {
  try {
    const { title, originalFileName, fileType, fileSize, extractedText } = req.body;

    if (!extractedText) {
      return res.status(400).json({
        success: false,
        message: "Extracted document text is required.",
      });
    }

    // Validate content
    const validation = validateDocumentContent(extractedText);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const stats = getStats(validation.cleanedText);
    const docTitle = title && title.trim() ? title.trim() : (originalFileName || "Untitled Study Document");
    const isTeacher = req.user.role === "teacher";
    const validFileTypes = ["pdf", "docx", "text", "code", "image", "other"];
    const normalizedFileType = validFileTypes.includes((fileType || "").toLowerCase())
      ? fileType.toLowerCase()
      : "other";

    const document = await Document.create({
      studentId: req.user._id,
      teacherId: isTeacher ? req.user._id : null,
      isTeacherMaterial: isTeacher,
      title: docTitle,
      originalFileName: originalFileName || (isTeacher ? "faculty_handout.pdf" : "document.pdf"),
      fileType: normalizedFileType,
      fileSize: fileSize || 0,
      extractedText: validation.cleanedText,
      wordCount: stats.wordCount,
      characterCount: stats.characterCount,
      processingStatus: "ready",
    });

    res.status(201).json({
      success: true,
      message: "Document saved successfully.",
      document: {
        id: document._id,
        title: document.title,
        originalFileName: document.originalFileName,
        fileType: document.fileType,
        wordCount: document.wordCount,
        characterCount: document.characterCount,
        uploadDate: document.uploadDate,
        isTeacherMaterial: document.isTeacherMaterial,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Student's Documents with learning status (includes shared teacher documents)
 */
const getMyDocuments = async (req, res, next) => {
  try {
    let filter = { studentId: req.user._id };

    if (req.user.role === "student") {
      const profile = await StudentProfile.findOne({ userId: req.user._id });
      if (profile && profile.teacherId) {
        filter = {
          $or: [
            { studentId: req.user._id },
            { teacherId: profile.teacherId },
            { isTeacherMaterial: true },
          ],
        };
      } else {
        filter = {
          $or: [
            { studentId: req.user._id },
            { isTeacherMaterial: true },
          ],
        };
      }
    } else if (req.user.role === "teacher") {
      filter = {
        $or: [
          { studentId: req.user._id },
          { teacherId: req.user._id },
          { isTeacherMaterial: true },
        ],
      };
    }

    const documents = await Document.find(filter)
      .populate("teacherId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Attach AI result and Quiz metadata
    const docIds = documents.map((d) => d._id);
    const aiResults = await AIResult.find({ documentId: { $in: docIds } }).lean();
    const quizzes = await Quiz.find({ documentId: { $in: docIds } }).lean();
    const attempts = await QuizAttempt.find({ studentId: req.user._id })
      .sort({ completedAt: -1 })
      .lean();

    const enriched = documents.map((doc) => {
      const ai = aiResults.find((a) => a.documentId.toString() === doc._id.toString());
      const q = quizzes.find((qz) => qz.documentId.toString() === doc._id.toString());
      const latestAttempt = attempts.find(
        (att) => att.documentId.toString() === doc._id.toString()
      );
      const isFromTeacher = Boolean(doc.isTeacherMaterial || (doc.teacherId && doc.teacherId.toString() !== req.user._id.toString()));

      return {
        id: doc._id,
        title: doc.title,
        originalFileName: doc.originalFileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        wordCount: doc.wordCount,
        uploadDate: doc.uploadDate,
        isTeacherMaterial: isFromTeacher,
        teacherName: doc.teacherId?.name || (isFromTeacher ? "Faculty Instructor" : null),
        hasSummary: Boolean(ai?.summary),
        hasNotes: Boolean(ai?.importantNotes || ai?.quickNotes),
        hasQuestions: Boolean(ai?.questions && ai.questions.length > 0),
        hasQuiz: Boolean(q && q.questions && q.questions.length > 0),
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
 * Get Single Document by ID with AI results and Quiz
 */
const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    // Role-based authorization: allow document owner, shared teacher material, or assigned teacher
    if (req.user.role === "student") {
      const isOwner = document.studentId.equals(req.user._id);
      const isShared = document.isTeacherMaterial;
      if (!isOwner && !isShared) {
        const profile = await StudentProfile.findOne({ userId: req.user._id });
        const isFromMyTeacher = profile && profile.teacherId && document.teacherId && profile.teacherId.equals(document.teacherId);
        if (!isFromMyTeacher) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You cannot view other students' documents.",
          });
        }
      }
    } else if (req.user.role === "teacher") {
      const isTeacherOwner = (document.teacherId && document.teacherId.equals(req.user._id)) || document.isTeacherMaterial || document.studentId.equals(req.user._id);
      if (!isTeacherOwner) {
        // Verify student belongs to this teacher
        const profile = await StudentProfile.findOne({
          userId: document.studentId,
          teacherId: req.user._id,
        });

        if (!profile) {
          return res.status(403).json({
            success: false,
            message: "Access denied. This student is not assigned to your classes.",
          });
        }
      }
    }

    const language = getValidLanguage(req.query.lang || req.query.language);
    const aiResult = await AIResult.findOne({ documentId: document._id, language });
    const quiz = await Quiz.findOne({ documentId: document._id, language });
    const attempts = await QuizAttempt.find({ documentId: document._id }).sort({
      completedAt: -1,
    });

    res.json({
      success: true,
      language,
      document: {
        id: document._id,
        studentId: document.studentId,
        title: document.title,
        originalFileName: document.originalFileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        extractedText: document.extractedText,
        wordCount: document.wordCount,
        characterCount: document.characterCount,
        uploadDate: document.uploadDate,
      },
      aiResult: aiResult || null,
      quiz: quiz
        ? {
            id: quiz._id,
            language: quiz.language,
            questions: quiz.questions,
          }
        : null,
      attempts,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete Document
 */
const deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (!document.studentId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    // Cascade delete related records
    await Promise.all([
      Document.deleteOne({ _id: document._id }),
      AIResult.deleteMany({ documentId: document._id }),
      Quiz.deleteMany({ documentId: document._id }),
      QuizAttempt.deleteMany({ documentId: document._id }),
      TutorChat.deleteMany({ documentId: document._id }),
    ]);

    res.json({
      success: true,
      message: "Document and all associated study materials deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createDocument,
  getMyDocuments,
  getDocumentById,
  deleteDocument,
};
