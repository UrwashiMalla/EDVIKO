const Document = require("../models/Document");
const AIResult = require("../models/AIResult");
const Quiz = require("../models/Quiz");
const TutorChat = require("../models/TutorChat");
const groqService = require("../services/groqService");
const {
  getValidLanguage,
  SUPPORTED_LANGUAGES,
  detectLanguageSwitch,
} = require("../utils/languageHelper");

/**
 * Helper to resolve text from documentId or body.text
 */
const resolveDocumentText = async (req, isOptional = false) => {
  const { documentId, text } = req.body;

  if (documentId) {
    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new Error("Document not found with the provided ID.");
    }
    // Verify ownership if student (allow if student owns it or if it is teacher material)
    if (req.user.role === "student" && !doc.studentId.equals(req.user._id) && !doc.isTeacherMaterial) {
      const StudentProfile = require("../models/StudentProfile");
      const profile = await StudentProfile.findOne({ userId: req.user._id });
      const isFromTeacher = profile && profile.teacherId && doc.teacherId && profile.teacherId.equals(doc.teacherId);
      if (!isFromTeacher) {
        throw new Error("Unauthorized to access this document.");
      }
    }
    return {
      text: doc.extractedText || "",
      documentId: doc._id,
      studentId: doc.studentId,
    };
  }

  if (text && text.trim()) {
    return {
      text: text.trim(),
      documentId: null,
      studentId: req.user._id,
    };
  }

  if (isOptional) {
    return {
      text: "",
      documentId: null,
      studentId: req.user ? req.user._id : null,
    };
  }

  throw new Error("Study content or valid document ID is required.");
};

/**
 * Helper to update or create AIResult scoped by documentId AND language
 */
const upsertAIResult = async (documentId, studentId, language, updates) => {
  if (!documentId) return null;
  return await AIResult.findOneAndUpdate(
    { documentId, language },
    {
      $set: {
        studentId,
        language,
        generatedLanguage: language,
        ...updates,
      },
    },
    { returnDocument: "after", upsert: true }
  );
};

/**
 * Generate Smart Summary
 */
const getSummary = async (req, res, next) => {
  try {
    const language = getValidLanguage(req.body.language);
    const forceRegenerate = Boolean(req.body.forceRegenerate);
    const { text, documentId, studentId } = await resolveDocumentText(req);

    // Return cached summary ONLY if language matches and regeneration not requested
    if (documentId && !forceRegenerate) {
      const existing = await AIResult.findOne({ documentId, language });
      if (existing && existing.summary && existing.summary.trim().length > 0) {
        return res.json({
          success: true,
          cached: true,
          language,
          summary: existing.summary,
        });
      }
    }

    const summary = await groqService.generateSummary(text, language);

    if (documentId) {
      await upsertAIResult(documentId, studentId, language, {
        summary,
      });
    }

    res.json({
      success: true,
      cached: false,
      language,
      summary,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate Quick Notes
 */
const getQuickNotes = async (req, res, next) => {
  try {
    const language = getValidLanguage(req.body.language);
    const forceRegenerate = Boolean(req.body.forceRegenerate);
    const { text, documentId, studentId } = await resolveDocumentText(req);

    if (documentId && !forceRegenerate) {
      const existing = await AIResult.findOne({ documentId, language });
      if (existing && existing.quickNotes && existing.quickNotes.trim().length > 0) {
        return res.json({
          success: true,
          cached: true,
          language,
          quickNotes: existing.quickNotes,
        });
      }
    }

    const quickNotes = await groqService.generateQuickNotes(text, language);

    if (documentId) {
      await upsertAIResult(documentId, studentId, language, {
        quickNotes,
      });
    }

    res.json({
      success: true,
      cached: false,
      language,
      quickNotes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate Important Notes
 */
const getImportantNotes = async (req, res, next) => {
  try {
    const language = getValidLanguage(req.body.language);
    const forceRegenerate = Boolean(req.body.forceRegenerate);
    const { text, documentId, studentId } = await resolveDocumentText(req);

    if (documentId && !forceRegenerate) {
      const existing = await AIResult.findOne({ documentId, language });
      if (existing && existing.importantNotes && existing.importantNotes.trim().length > 0) {
        return res.json({
          success: true,
          cached: true,
          language,
          notes: existing.importantNotes,
        });
      }
    }

    const notes = await groqService.generateImportantNotes(text, language);

    if (documentId) {
      await upsertAIResult(documentId, studentId, language, {
        importantNotes: notes,
      });
    }

    res.json({
      success: true,
      cached: false,
      language,
      notes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate 10 Practice Questions
 */
const getQuestions = async (req, res, next) => {
  try {
    const language = getValidLanguage(req.body.language);
    const forceRegenerate = Boolean(req.body.forceRegenerate);
    const { text, documentId, studentId } = await resolveDocumentText(req);

    if (documentId && !forceRegenerate) {
      const existing = await AIResult.findOne({ documentId, language });
      if (existing && Array.isArray(existing.questions) && existing.questions.length === 10) {
        return res.json({
          success: true,
          cached: true,
          language,
          questions: existing.questions,
        });
      }
    }

    const questions = await groqService.generateQuestions(text, language, forceRegenerate);

    if (documentId) {
      await upsertAIResult(documentId, studentId, language, {
        questions,
      });
    }

    res.json({
      success: true,
      cached: false,
      language,
      questions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate 10 MCQ Quiz
 */
const getQuiz = async (req, res, next) => {
  try {
    const language = getValidLanguage(req.body.language);
    const forceRegenerate = Boolean(req.body.forceRegenerate);
    const { text, documentId, studentId } = await resolveDocumentText(req);

    // Look up quiz specifically for this document AND this language
    if (documentId && !forceRegenerate) {
      const existingQuiz = await Quiz.findOne({ documentId, language });
      if (existingQuiz && Array.isArray(existingQuiz.questions) && existingQuiz.questions.length === 10) {
        return res.json({
          success: true,
          cached: true,
          quizId: existingQuiz._id,
          language,
          quiz: existingQuiz.questions,
        });
      }
    }

    const quizQuestions = await groqService.generateQuiz(text, language, forceRegenerate);

    let savedQuiz = null;
    if (documentId) {
      savedQuiz = await Quiz.findOneAndUpdate(
        { documentId, language },
        {
          $set: {
            studentId,
            language,
            questions: quizQuestions,
          },
        },
        { returnDocument: "after", upsert: true }
      );
    }

    res.json({
      success: true,
      cached: false,
      quizId: savedQuiz ? savedQuiz._id : null,
      language,
      quiz: quizQuestions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * AI Tutor Query (Multi-turn conversation memory with seamless language switching)
 */
const askTutor = async (req, res, next) => {
  try {
    const { question } = req.body;
    let language = getValidLanguage(req.body.language);
    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question text is required.",
      });
    }

    let { text, documentId, studentId } = await resolveDocumentText(req, true);

    // If query is sent without documentId/text, automatically ground to the student's latest uploaded PDF / study material
    if ((!text || !text.trim()) && !documentId && req.user) {
      try {
        const StudentProfile = require("../models/StudentProfile");
        const profile = await StudentProfile.findOne({ userId: req.user._id });
        const teacherId = profile?.teacherId;

        const latestDoc = await Document.findOne({
          $or: [
            { studentId: req.user._id },
            ...(teacherId ? [{ teacherId }] : []),
            { isTeacherMaterial: true },
          ],
        }).sort({ createdAt: -1 });

        if (latestDoc) {
          text = latestDoc.extractedText || "";
          documentId = latestDoc._id;
        }
      } catch (docErr) {
        console.warn("Auto document grounding fallback warning:", docErr.message);
      }
    }

    // 1. Language-Switch Intent Detection BEFORE Document QA
    const switchTarget = detectLanguageSwitch(question);
    if (switchTarget) {
      const activeLanguage = switchTarget;
      const switchAnswer = `Language switched to ${activeLanguage}.`;

      let chat = null;
      if (documentId) {
        chat = await TutorChat.findOne({ documentId, studentId, language: activeLanguage });
        if (!chat) {
          chat = await TutorChat.findOne({ documentId, studentId }).sort({ updatedAt: -1 });
        }
        if (!chat) {
          chat = new TutorChat({
            documentId,
            studentId,
            language: activeLanguage,
            messages: [],
          });
        }

        chat.language = activeLanguage;
        chat.messages.push(
          { role: "user", content: question.trim(), timestamp: new Date() },
          { role: "assistant", content: switchAnswer, timestamp: new Date() }
        );
        await chat.save();
      }

      return res.json({
        success: true,
        isLanguageSwitch: true,
        language: activeLanguage,
        answer: switchAnswer,
        history: chat ? chat.messages : (Array.isArray(req.body.history) ? req.body.history : []),
      });
    }

    // 2. Regular Study Query with Document Grounding
    let chat = null;
    let history = [];
    if (documentId) {
      chat = await TutorChat.findOne({ documentId, studentId, language });
      if (!chat) {
        chat = await TutorChat.findOne({ documentId, studentId }).sort({ updatedAt: -1 });
      }
      if (chat) {
        history = chat.messages;
      }
    } else if (Array.isArray(req.body.history)) {
      history = req.body.history;
    }

    // Generate grounded response in target language
    const answer = await groqService.generateTutorResponse(
      text,
      question.trim(),
      history,
      language
    );

    // Persist new turn
    if (documentId) {
      if (!chat) {
        chat = new TutorChat({
          documentId,
          studentId,
          language,
          messages: [],
        });
      }

      chat.language = language;
      chat.messages.push(
        { role: "user", content: question.trim(), timestamp: new Date() },
        { role: "assistant", content: answer, timestamp: new Date() }
      );

      await chat.save();
    }

    res.json({
      success: true,
      language,
      answer,
      history: chat ? chat.messages : [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Tutor Chat History by Document and Language
 */
const getTutorHistory = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const requestedLang = req.query.lang || req.query.language;
    const language = getValidLanguage(requestedLang);

    let chat = await TutorChat.findOne({
      documentId,
      studentId: req.user._id,
      language,
    });

    if (!chat) {
      chat = await TutorChat.findOne({
        documentId,
        studentId: req.user._id,
      }).sort({ updatedAt: -1 });
    }

    res.json({
      success: true,
      language: chat ? chat.language : language,
      messages: chat ? chat.messages : [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Clear Tutor Chat History
 */
const clearTutorHistory = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    await TutorChat.deleteMany({
      documentId,
      studentId: req.user._id,
    });

    res.json({
      success: true,
      message: "Chat history cleared successfully.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSummary,
  getQuickNotes,
  getImportantNotes,
  getQuestions,
  getQuiz,
  askTutor,
  getTutorHistory,
  clearTutorHistory,
};
