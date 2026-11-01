const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ["student_verification", "teacher_verification", "password_reset"],
    default: "student_verification",
  },
  verified: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: "15m" }, // automatically delete after 15 minutes
  },
});

module.exports = mongoose.model("Otp", otpSchema);
