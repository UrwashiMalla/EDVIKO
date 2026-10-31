const bcrypt = require("bcryptjs");
const User = require("../models/User");
const TeacherProfile = require("../models/TeacherProfile");
const StudentProfile = require("../models/StudentProfile");

const seedInitialData = async () => {
  try {
    let teacher = await User.findOne({ email: "teacher@lerniq.edu" });
    if (!teacher) {
      console.log("[SEED] Creating default faculty member...");
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("Teacher@123", salt);

      teacher = await User.create({
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

    let teacherProfile = await TeacherProfile.findOne({ userId: teacher._id });
    if (!teacherProfile) {
      teacherProfile = await TeacherProfile.create({
        userId: teacher._id,
        teacherCode: "TEACH-101",
        department: "Computer Science & AI",
        students: [],
      });
    }

    // Preserve real registered student "u"
    let studentU = await User.findOne({ email: "u@lerniq.edu" });
    if (!studentU) {
      studentU = await User.create({
        name: "u",
        email: "u@lerniq.edu",
        passwordHash: "$2b$10$1edzGrbhqTAW7VKosHXDv.fyRuNZUQDR.JtqBvQAaCasJL/caeHh6",
        role: "student",
        isVerified: true,
      });

      await StudentProfile.create({
        userId: studentU._id,
        teacherId: teacher._id,
        gradeOrClass: "College / University",
      });

      teacherProfile.students.addToSet(studentU._id);
      await teacherProfile.save();
      console.log("[SEED] Enrolled real student 'u' (u@lerniq.edu)");
    } else {
      if (!teacherProfile.students.some((s) => String(s) === String(studentU._id))) {
        teacherProfile.students.addToSet(studentU._id);
        await teacherProfile.save();
      }
    }
  } catch (err) {
    console.warn("[SEED] Seeding warning:", err.message);
  }
};

module.exports = seedInitialData;
