const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const Document = require("../models/Document");
const StudentProfile = require("../models/StudentProfile");
const { getValidLanguage } = require("../utils/languageHelper");

/**
 * Get Quiz by Document ID
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
 * Submit Quiz Attempt & Calculate Score
 */
const submitQuizAttempt = async (req, res, next) => {
  try {
    const { id: quizId } = req.params;
    const { answers } = req.body; // array of { questionIndex, selectedAnswer }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Valid answers array is required.",
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found.",
      });
    }

    const totalQuestions = quiz.questions.length;
    let score = 0;

    const evaluatedAnswers = answers.map((ans) => {
      const q = quiz.questions[ans.questionIndex];
      const correctAnswer = q ? q.correctAnswer : 0;
      const isCorrect = ans.selectedAnswer === correctAnswer;
      if (isCorrect) score += 1;

      return {
        questionIndex: ans.questionIndex,
        selectedAnswer: ans.selectedAnswer,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect,
      };
    });

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    const attempt = await QuizAttempt.create({
      quizId: quiz._id,
      documentId: quiz.documentId,
      studentId: req.user._id,
      answers: evaluatedAnswers,
      score,
      totalQuestions,
      percentage,
      completedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Quiz attempt saved successfully.",
      result: {
        attemptId: attempt._id,
        score,
        totalQuestions,
        percentage,
        completedAt: attempt.completedAt,
        answers: evaluatedAnswers,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Attempts for a specific document / quiz
 */
const getAttempts = async (req, res, next) => {
  try {
    const { id: quizId } = req.params;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found.",
      });
    }

    let filter = { quizId: quiz._id };
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
  getQuizByDocumentId,
  submitQuizAttempt,
  getAttempts,
};
