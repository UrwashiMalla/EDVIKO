const crypto = require("crypto");
const Otp = require("../models/Otp");

const generateOtp = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Generate 6-digit numeric OTP
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Remove existing OTPs for this email
  await Otp.deleteMany({ email: normalizedEmail });

  // Store new OTP
  await Otp.create({
    email: normalizedEmail,
    otp: otpCode,
    expiresAt,
  });

  console.log(`[AUTH] Generated OTP for ${normalizedEmail}: ${otpCode}`);

  return {
    otp: otpCode,
    expiresAt,
  };
};

const verifyOtp = async (email, enteredOtp) => {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedOtp = enteredOtp.trim();

  // Check DEV_OTP fallback if configured in development
  const devOtp = process.env.DEV_OTP;
  if (devOtp && trimmedOtp === devOtp) {
    console.log(`[AUTH] Dev OTP matched for ${normalizedEmail}`);
    await Otp.deleteMany({ email: normalizedEmail });
    return true;
  }

  const record = await Otp.findOne({
    email: normalizedEmail,
    otp: trimmedOtp,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return false;
  }

  // Consume OTP
  await Otp.deleteOne({ _id: record._id });
  return true;
};

module.exports = {
  generateOtp,
  verifyOtp,
};
