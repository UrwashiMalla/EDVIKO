require("dotenv").config({ path: "server/.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../server/models/User");
const TeacherProfile = require("../server/models/TeacherProfile");
const StudentProfile = require("../server/models/StudentProfile");
const seedInitialData = require("../server/utils/seed");

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/edviko";
  console.log("Connecting to Mongo:", mongoUri);
  await mongoose.connect(mongoUri);

  console.log("Running seed...");
  await seedInitialData();

  // Test teacher
  let teacher = await User.findOne({ email: "teacher@lerniq.edu" });
  if (teacher) {
    const isMatch = await teacher.matchPassword("Teacher@123");
    console.log("Teacher match 'Teacher@123':", isMatch);
    if (!isMatch) {
      console.log("Updating teacher password to 'Teacher@123'...");
      const salt = await bcrypt.genSalt(10);
      teacher.passwordHash = await bcrypt.hash("Teacher@123", salt);
      await teacher.save();
      console.log("Teacher password reset to 'Teacher@123'!");
    }
    const prof = await TeacherProfile.findOne({ userId: teacher._id });
    console.log("Teacher code:", prof?.teacherCode);
  }

  // Check student u
  let studentU = await User.findOne({ email: "u@lerniq.edu" });
  if (studentU) {
    // Let's set a known password for student u if needed, e.g. '12345678'
    const isPass = await studentU.matchPassword("12345678");
    console.log("Student 'u' match '12345678':", isPass);
    if (!isPass) {
      const salt = await bcrypt.genSalt(10);
      studentU.passwordHash = await bcrypt.hash("12345678", salt);
      studentU.username = "u";
      await studentU.save();
      console.log("Student 'u' password updated to '12345678'");
    }
  }

  console.log("Done checking DB!");
  await mongoose.disconnect();
}

run().catch(console.error);
