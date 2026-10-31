const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      default: "Faculty Instructor",
    },
    senderRole: {
      type: String,
      enum: ["teacher", "student"],
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    recipientName: {
      type: String,
      default: "All Students",
    },
    classroomCode: {
      type: String,
      default: "",
      index: true,
    },
    isBroadcast: {
      type: Boolean,
      default: false,
      index: true,
    },
    title: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["Normal", "High", "Urgent"],
      default: "Normal",
    },
    tag: {
      type: String,
      default: "Announcement",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ classroomCode: 1, isBroadcast: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
