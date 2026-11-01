const mongoose = require("mongoose");

const lectureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Lecture title is required"],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      default: "General",
    },
    classroomCode: {
      type: String,
      required: [true, "Classroom code is required"],
      uppercase: true,
      trim: true,
      index: true,
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
    duration: {
      type: String,
      default: "45 min",
    },
    videoEmbedUrl: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    takeaways: [
      {
        type: String,
      },
    ],
    content: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

lectureSchema.index({ classroomCode: 1, createdAt: -1 });

module.exports = mongoose.model("Lecture", lectureSchema);
