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
  unremoveStudentFromClass,
  getRemovedStudents,
  sendBroadcast,
  getBroadcasts,
  sendDirectMessage,
  getStudentDirectMessages,
  getConversationsList,
} = require("../controllers/teacherController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(requireRole("teacher"));

router.get("/dashboard", getTeacherDashboard);
router.get("/students", getAssignedStudents);
router.get("/students/removed", getRemovedStudents);
router.get("/students/:studentId", getStudentDetails);
router.get("/students/:studentId/quiz-results", getStudentQuizResults);
router.get("/documents", getAllAssignedDocuments);
router.get("/quiz-results", getAllAssignedQuizResults);

// Student Removal & Unremoval
router.delete("/students/:studentId", removeStudentFromClass);
router.post("/students/:studentId/remove", removeStudentFromClass);
router.post("/students/:studentId/unremove", unremoveStudentFromClass);

// Messaging: Group Broadcast & Personal Direct Messages
router.post("/broadcast", sendBroadcast);
router.get("/broadcasts", getBroadcasts);
router.get("/conversations", getConversationsList);
router.post("/students/:studentId/message", sendDirectMessage);
router.post("/message", sendDirectMessage);
router.get("/students/:studentId/messages", getStudentDirectMessages);

module.exports = router;
