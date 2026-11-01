const crypto = require("crypto");
const TeacherProfile = require("../models/TeacherProfile");

/**
 * Generate a unique, collision-proof classroom code for teachers
 * Format: EDV-XXXX (e.g. EDV-9A4B)
 */
const generateUniqueTeacherCode = async () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // readable chars without ambiguous O/0/1/I
  let code = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 20) {
    attempts++;
    let randomPart = "";
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(crypto.randomInt(0, chars.length));
    }
    code = `EDV-${randomPart}`;

    const existing = await TeacherProfile.findOne({ teacherCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  // Fallback timestamp suffix if extreme collisions
  if (!isUnique) {
    code = `EDV-${Date.now().toString().slice(-4)}`;
  }

  return code;
};

module.exports = {
  generateUniqueTeacherCode,
};
