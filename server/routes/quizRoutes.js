const express = require("express");
const router = express.Router();
const {
  generateAiQuizPreview,
  publishQuiz,
  listQuizzes,
  getQuizById,
  submitQuizAttempt,
  deleteQuiz,
  getQuizSubmissions,
  getQuizByDocumentId,
  getAttempts,
} = require("../controllers/quizController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.use(authenticate);

// List classroom quizzes (teacher sees authored; student sees classroom's published)
router.get("/", listQuizzes);

// Teacher AI quiz preview generation
router.post("/generate-preview", requireRole("teacher"), generateAiQuizPreview);

// Teacher publishes a quiz (AI-generated or manual)
router.post("/", requireRole("teacher"), publishQuiz);

// Get single quiz (with security stripping for students who haven't attempted yet)
router.get("/:id", getQuizById);

// Submit quiz attempt (evaluated securely on backend)
router.post("/:id/attempt", submitQuizAttempt);

// Teacher deletes quiz
router.delete("/:id", requireRole("teacher"), deleteQuiz);

// Teacher views submissions for a specific quiz
router.get("/:id/submissions", requireRole("teacher"), getQuizSubmissions);

// Backward compatibility routes
router.get("/document/:documentId", getQuizByDocumentId);
router.get("/:id/attempts", getAttempts);

module.exports = router;
