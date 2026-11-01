const mongoose = require("mongoose");

const teacherProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    teacherCode: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true,
    },
    universityOrCollege: {
      type: String,
      default: "University / College",
      trim: true,
    },
    department: {
      type: String,
      default: "General Academics",
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    removedStudents: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        email: {
          type: String,
          lowercase: true,
          trim: true,
        },
        name: {
          type: String,
          default: "Student",
        },
        removedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: "Removed by instructor",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("TeacherProfile", teacherProfileSchema);
