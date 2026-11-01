const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  updateProfile,
  changeClassroom,
  getClassroomBroadcasts,
  getDirectMessagesWithTeacher,
  sendDirectMessageToTeacher,
} = require("../controllers/studentController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(requireRole("student"));

router.get("/me/dashboard", getDashboardStats);
router.put("/me/profile", updateProfile);
router.post("/classroom/change", changeClassroom);

// Messaging: Classroom Broadcasts & Personal Direct Messages
router.get("/messages/broadcasts", getClassroomBroadcasts);
router.get("/messages/direct", getDirectMessagesWithTeacher);
router.post("/messages/direct", sendDirectMessageToTeacher);

module.exports = router;
