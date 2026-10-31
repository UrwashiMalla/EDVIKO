const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    classroomCode: {
      type: String,
      default: "",
      index: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Assessment Quiz",
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    subject: {
      type: String,
      default: "General",
      trim: true,
    },
    timeLimit: {
      type: Number,
      default: null, // null or 0 means untimed / unlimited
    },
    passingScore: {
      type: Number,
      default: 60,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Difficult", "Hard"],
      default: "Medium",
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      enum: ["teacher", "student", "ai"],
      default: "teacher",
    },
    language: {
      type: String,
      default: "English",
    },
    questions: [
      {
        question: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: Number, required: true }, // Index 0..3
        explanation: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Partial compound index so multiple quizzes with null documentId can coexist without conflict
quizSchema.index(
  { documentId: 1, language: 1 },
  { unique: true, partialFilterExpression: { documentId: { $type: "objectId" } } }
);
quizSchema.index({ classroomCode: 1, isPublished: 1 });
quizSchema.index({ teacherId: 1, createdAt: -1 });

module.exports = mongoose.model("Quiz", quizSchema);
