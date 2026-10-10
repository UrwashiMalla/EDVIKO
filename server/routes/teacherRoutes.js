const express = require("express");
const router = express.Router();
const {
  getTeacherDashboard,
  getAssignedStudents,
  getStudentDetails,
  getStudentQuizResults,
  getAllAssignedDocuments,
  getAllAssignedQuizResults,
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

module.exports = router;
