const bcrypt = require("bcryptjs");
const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");

const seedInitialData = async () => {
  try {
    const existingTeacher = await User.findOne({ email: "teacher@lerniq.edu" });
    if (!existingTeacher) {
      console.log("[SEED] Creating default faculty member...");
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("Teacher@123", salt);

      const teacher = await User.create({
        name: "Prof. Sarah Jenkins",
        email: "teacher@lerniq.edu",
        passwordHash,
        role: "teacher",
        isVerified: true,
      });

      await TeacherProfile.create({
        userId: teacher._id,
        teacherCode: "TEACH-101",
        department: "Computer Science & AI",
        students: [],
      });

      console.log("[SEED] Default teacher created: teacher@lerniq.edu / Teacher@123 (Code: TEACH-101)");
    }
  } catch (err) {
    console.warn("[SEED] Seeding warning:", err.message);
  }
};

module.exports = seedInitialData;
