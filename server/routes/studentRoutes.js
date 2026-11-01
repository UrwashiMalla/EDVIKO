const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  updateProfile,
  changeClassroom,
  validateClassroomCode,
  getStudentClassrooms,
  switchClassroom,
  getClassroomBroadcasts,
  getDirectMessagesWithTeacher,
  sendDirectMessageToTeacher,
  getStudentLectures,
  getStudentNotes,
} = require("../controllers/studentController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(requireRole("student"));

router.get("/me/dashboard", getDashboardStats);
router.put("/me/profile", updateProfile);

// Classroom Joining, Switching & History
router.post("/classroom/change", changeClassroom);
router.post("/classroom/join", changeClassroom);
router.post("/classroom/validate", validateClassroomCode);
router.get("/classrooms", getStudentClassrooms);
router.post("/classroom/switch", switchClassroom);

// Messaging: Classroom Broadcasts & Personal Direct Messages
router.get("/messages/broadcasts", getClassroomBroadcasts);
router.get("/messages/direct", getDirectMessagesWithTeacher);
router.post("/messages/direct", sendDirectMessageToTeacher);

// Course Materials: Lectures & Notes
router.get("/lectures", getStudentLectures);
router.get("/notes", getStudentNotes);

module.exports = router;
