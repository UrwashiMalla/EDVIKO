const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  updateProfile,
} = require("../controllers/studentController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(requireRole("student"));

router.get("/me/dashboard", getDashboardStats);
router.put("/me/profile", updateProfile);

module.exports = router;
