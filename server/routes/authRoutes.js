const express = require("express");
const router = express.Router();
const {
  sendStudentRegistrationOtp,
  verifyStudentRegistrationOtp,
  registerStudent,
  loginStudent,
  sendTeacherRegistrationOtp,
  verifyTeacherRegistrationOtp,
  registerTeacher,
  loginTeacher,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  resendOtp,
  getMe,
  logout,
  listTeachers,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimiter");

// Student Registration & Auth
router.post("/student/send-otp", authLimiter, sendStudentRegistrationOtp);
router.post("/student/verify-otp", authLimiter, verifyStudentRegistrationOtp);
router.post("/student/register", authLimiter, registerStudent);
router.post("/student/login", authLimiter, loginStudent);

// Teacher Registration & Auth
router.post("/teacher/send-otp", authLimiter, sendTeacherRegistrationOtp);
router.post("/teacher/verify-otp", authLimiter, verifyTeacherRegistrationOtp);
router.post("/teacher/register", authLimiter, registerTeacher);
router.post("/teacher/login", authLimiter, loginTeacher);

// Forgot Password
router.post("/forgot-password/send-otp", authLimiter, sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", authLimiter, verifyForgotPasswordOtp);
router.post("/forgot-password/reset", authLimiter, resetPasswordWithOtp);

// General OTP Resend
router.post("/resend-otp", authLimiter, resendOtp);

// Session & Public
router.post("/logout", logout);
router.get("/me", authenticate, getMe);
router.get("/teachers", listTeachers);

module.exports = router;
