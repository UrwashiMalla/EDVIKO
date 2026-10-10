const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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

quizSchema.index({ documentId: 1, language: 1 }, { unique: true });

module.exports = mongoose.model("Quiz", quizSchema);
