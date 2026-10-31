const express = require("express");
const router = express.Router();
const {
  getTeacherDashboard,
  getAssignedStudents,
  getStudentDetails,
  getStudentQuizResults,
  getAllAssignedDocuments,
  getAllAssignedQuizResults,
  removeStudentFromClass,
  sendBroadcast,
  getBroadcasts,
  sendDirectMessage,
  getStudentDirectMessages,
} = require("../controllers/teacherController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(requireRole("teacher"));

router.get("/dashboard", getTeacherDashboard);
router.get("/students", getAssignedStudents);
router.get("/students/:studentId", getStudentDetails);
router.get("/students/:studentId/quiz-results", getStudentQuizResults);
router.get("/documents", getAllAssignedDocuments);
router.get("/quiz-results", getAllAssignedQuizResults);
router.delete("/students/:studentId", removeStudentFromClass);
router.post("/students/:studentId/remove", removeStudentFromClass);

// Messaging: Group Broadcast & Direct 1-on-1 Message to particular student
router.post("/broadcast", sendBroadcast);
router.get("/broadcasts", getBroadcasts);
router.post("/students/:studentId/message", sendDirectMessage);
router.post("/message", sendDirectMessage);
router.get("/students/:studentId/messages", getStudentDirectMessages);

module.exports = router;
