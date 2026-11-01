const express = require("express");
const router = express.Router();
const {
  sendSignupOtp,
  verifySignupOtp,
  registerStudent,
  verifyStudentOtp,
  resendOtp,
  loginStudent,
  loginTeacher,
  getMe,
  logout,
  listTeachers,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimiter");

router.post("/send-signup-otp", authLimiter, sendSignupOtp);
router.post("/verify-signup-otp", authLimiter, verifySignupOtp);
router.post("/student/register", authLimiter, registerStudent);
router.post("/student/login", authLimiter, loginStudent);
router.post("/teacher/login", authLimiter, loginTeacher);
router.post("/verify-otp", authLimiter, verifyStudentOtp);
router.post("/resend-otp", authLimiter, resendOtp);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);
router.get("/teachers", listTeachers);

module.exports = router;
