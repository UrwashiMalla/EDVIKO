const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Otp = require("../models/Otp");

const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes validity
const MAX_ATTEMPTS = 5;

/**
 * Generate a secure 6-digit verification OTP and save hashed version to MongoDB
 */
const generateOtp = async (email, purpose = "student_verification") => {
  const normalizedEmail = email.toLowerCase().trim();

  // Check resend cooldown
  const existingOtp = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (existingOtp) {
    const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      const err = new Error(`Please wait ${waitSec} seconds before requesting a new verification code.`);
      err.status = 429;
      err.retryAfter = waitSec;
      throw err;
    }
  }

  // Generate cryptographically strong 6-digit numeric OTP
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  // Hash OTP with bcrypt before saving (never store plain-text OTPs)
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(rawOtp, salt);

  // Clear previous OTPs for this email and purpose
  await Otp.deleteMany({ email: normalizedEmail, purpose });

  // Store new OTP record
  await Otp.create({
    email: normalizedEmail,
    otpHash,
    purpose,
    attempts: 0,
    verified: false,
    expiresAt,
  });

  console.log(`[AUTH] 🔒 Generated and securely hashed 5-minute OTP for ${normalizedEmail} (${purpose})`);

  return {
    otp: rawOtp, // returned only for dispatching via email
    expiresAt,
  };
};

/**
 * Verify submitted OTP against hashed database record (with legacy support)
 */
const verifyOtp = async (email, enteredOtp, purpose = "student_verification") => {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedOtp = String(enteredOtp || "").trim();

  if (!trimmedOtp) {
    return { success: false, message: "Please enter the 6-digit verification code." };
  }

  // Dev code fallback in development environment
  const devOtp = process.env.DEV_OTP;
  if (devOtp && trimmedOtp === devOtp && process.env.NODE_ENV !== "production") {
    console.log(`[AUTH] 🧪 Dev OTP matched for ${normalizedEmail} (${purpose})`);
    let record = await Otp.findOne({ email: normalizedEmail, purpose });
    if (!record) {
      const salt = await bcrypt.genSalt(10);
      const otpHash = await bcrypt.hash(devOtp, salt);
      record = await Otp.create({
        email: normalizedEmail,
        otpHash,
        purpose,
        verified: true,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      });
    } else {
      record.verified = true;
      await record.save();
    }
    return { success: true };
  }

  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose,
  }).sort({ createdAt: -1 });

  if (!record) {
    return {
      success: false,
      message: "No verification code requested or code has expired. Please request a new code.",
    };
  }

  // Check expiration (strict 5 minutes)
  if (new Date() > record.expiresAt) {
    await Otp.deleteOne({ _id: record._id });
    return {
      success: false,
      message: "Verification code has expired (valid for 5 minutes). Please request a new code.",
    };
  }

  // Check attempt limit
  if (record.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    return {
      success: false,
      message: "Too many failed attempts. For your security, this code has been invalidated. Please request a new code.",
    };
  }

  // Compare using bcrypt hash if present, or legacy plain-text fallback
  let isMatch = false;
  if (record.otpHash) {
    isMatch = await bcrypt.compare(trimmedOtp, record.otpHash);
  } else if (record.otp) {
    isMatch = trimmedOtp === record.otp;
  }

  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      success: false,
      message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
  }

  // Mark verified
  record.verified = true;
  await record.save();

  return { success: true };
};

/**
 * Check if email was successfully verified within window
 */
const isEmailVerified = async (email, purpose = "student_verification") => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    verified: true,
    expiresAt: { $gt: new Date() },
  });
  return Boolean(record);
};

/**
 * Remove verified OTP after completed registration
 */
const clearVerifiedOtp = async (email, purpose = "student_verification") => {
  const normalizedEmail = email.toLowerCase().trim();
  await Otp.deleteMany({ email: normalizedEmail, purpose });
};

module.exports = {
  generateOtp,
  verifyOtp,
  isEmailVerified,
  clearVerifiedOtp,
};
