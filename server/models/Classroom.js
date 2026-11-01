const mongoose = require("mongoose");

const classroomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Classroom name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Classroom code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teacherName: {
      type: String,
      default: "Faculty Instructor",
    },
    subject: {
      type: String,
      default: "General Academics",
      trim: true,
    },
    department: {
      type: String,
      default: "Academics",
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Classroom", classroomSchema);
