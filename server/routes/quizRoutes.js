const express = require("express");
const router = express.Router();
const {
  getQuizByDocumentId,
  submitQuizAttempt,
  getAttempts,
} = require("../controllers/quizController");
const { authenticate } = require("../middleware/authMiddleware");

router.use(authenticate);

router.get("/document/:documentId", getQuizByDocumentId);
router.post("/:id/attempt", submitQuizAttempt);
router.get("/:id/attempts", getAttempts);

module.exports = router;
