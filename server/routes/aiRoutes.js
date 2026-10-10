const express = require("express");
const router = express.Router();
const {
  getSummary,
  getQuickNotes,
  getImportantNotes,
  getQuestions,
  getQuiz,
  askTutor,
  getTutorHistory,
  clearTutorHistory,
} = require("../controllers/aiController");
const { authenticate } = require("../middleware/authMiddleware");
const { aiLimiter } = require("../middleware/rateLimiter");

router.use(authenticate);

router.post("/summary", aiLimiter, getSummary);
router.post("/quick-notes", aiLimiter, getQuickNotes);
router.post("/important-notes", aiLimiter, getImportantNotes);
router.post("/questions", aiLimiter, getQuestions);
router.post("/quiz", aiLimiter, getQuiz);
router.post("/tutor", aiLimiter, askTutor);
router.get("/tutor/:documentId", getTutorHistory);
router.delete("/tutor/:documentId", clearTutorHistory);

module.exports = router;
