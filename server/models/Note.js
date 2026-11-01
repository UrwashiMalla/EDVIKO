const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Note title is required"],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      default: "General",
    },
    module: {
      type: String,
      default: "General Curriculum",
      trim: true,
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
    fileSize: {
      type: String,
      default: "1.2 MB",
    },
    pages: {
      type: String,
      default: "5-10 Pages",
    },
    description: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      required: [true, "Note content or handout text is required"],
    },
    fileName: {
      type: String,
      default: "",
    },
    fileUrl: {
      type: String,
      default: "",
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

noteSchema.index({ classroomCode: 1, createdAt: -1 });

module.exports = mongoose.model("Note", noteSchema);
