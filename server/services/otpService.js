const crypto = require("crypto");
const Otp = require("../models/Otp");

const generateOtp = async (email, purpose = "student_verification") => {
  const normalizedEmail = email.toLowerCase().trim();

  // Generate 6-digit numeric OTP
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

  // Remove existing OTPs for this email and purpose
  await Otp.deleteMany({ email: normalizedEmail, purpose });

  // Store new OTP
  await Otp.create({
    email: normalizedEmail,
    otp: otpCode,
    purpose,
    verified: false,
    expiresAt,
  });

  console.log(`[AUTH] Generated OTP for ${normalizedEmail} (${purpose}): ${otpCode}`);

  return {
    otp: otpCode,
    expiresAt,
  };
};

const verifyOtp = async (email, enteredOtp, purpose = "student_verification") => {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedOtp = String(enteredOtp).trim();

  // Check DEV_OTP fallback if configured in development
  const devOtp = process.env.DEV_OTP;
  if (devOtp && trimmedOtp === devOtp) {
    console.log(`[AUTH] Dev OTP matched for ${normalizedEmail} (${purpose})`);
    let record = await Otp.findOne({ email: normalizedEmail, purpose });
    if (!record) {
      record = await Otp.create({
        email: normalizedEmail,
        otp: devOtp,
        purpose,
        verified: true,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
    } else {
      record.verified = true;
      await record.save();
    }
    return true;
  }

  const record = await Otp.findOne({
    email: normalizedEmail,
    otp: trimmedOtp,
    purpose,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return false;
  }

  // Mark as verified so subsequent registration or password reset can be confirmed
  record.verified = true;
  await record.save();
  return true;
};

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
