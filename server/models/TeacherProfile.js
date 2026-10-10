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
    department: {
      type: String,
      default: "General Academics",
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("TeacherProfile", teacherProfileSchema);
