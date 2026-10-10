const mongoose = require("mongoose");

const aiResultSchema = new mongoose.Schema(
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
    summary: {
      type: String,
      default: "",
    },
    quickNotes: {
      type: String,
      default: "",
    },
    importantNotes: {
      type: String,
      default: "",
    },
    questions: [
      {
        question: { type: String, required: true },
        type: { type: String, default: "conceptual" },
        difficulty: { type: String, default: "medium" },
      },
    ],
    language: {
      type: String,
      default: "English",
      index: true,
    },
    generatedLanguage: {
      type: String,
      default: "English",
    },
  },
  {
    timestamps: true,
  }
);

aiResultSchema.index({ documentId: 1, language: 1 }, { unique: true });

module.exports = mongoose.model("AIResult", aiResultSchema);
