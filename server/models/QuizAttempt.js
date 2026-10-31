const mongoose = require("mongoose");

const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    },
    answers: [
      {
        questionIndex: { type: Number, required: true },
        question: { type: String, default: "" },
        options: [{ type: String }],
        selectedAnswer: { type: Number, default: -1 }, // -1 = unattempted
        correctAnswer: { type: Number, required: true },
        isCorrect: { type: Boolean, required: true },
        status: {
          type: String,
          enum: ["Correct", "Wrong", "Not Attempted"],
          required: true,
        },
        explanation: { type: String, default: "" },
      },
    ],
    score: {
      type: Number,
      required: true, // total correct answers
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    correctCount: {
      type: Number,
      default: 0,
    },
    wrongCount: {
      type: Number,
      default: 0,
    },
    unattemptedCount: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      required: true,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

quizAttemptSchema.index({ quizId: 1, studentId: 1, completedAt: -1 });

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
