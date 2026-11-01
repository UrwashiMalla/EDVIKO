const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Securely hashed OTP code (bcrypt)
    otpHash: {
      type: String,
      default: null,
    },
    // Legacy fallback field
    otp: {
      type: String,
      default: null,
    },
    purpose: {
      type: String,
      enum: ["student_verification", "teacher_verification", "password_reset"],
      default: "student_verification",
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    // Strict 5-minute expiration TTL index
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "5m" },
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model("Otp", otpSchema);
