const mongoose = require("mongoose");

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    username: {
      type: String,
      trim: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    classroomCode: {
      type: String,
      default: "",
      trim: true,
    },
    gradeOrClass: {
      type: String,
      default: "College / University",
    },
    avatar: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    classroomHistory: [
      {
        teacherId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        teacherCode: {
          type: String,
        },
        teacherName: {
          type: String,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        leftAt: {
          type: Date,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
