const Notification = require("../models/Notification");

/**
 * Get Notifications for current user (Student or Teacher)
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({
      success: true,
      unreadCount,
      count: notifications.length,
      notifications: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        quizId: n.quizId,
        senderName: n.senderName,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark all notifications as read for current user
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({
      success: true,
      message: "Notifications marked as read.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark single notification as read
 */
const markOneAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Notification.findOneAndUpdate(
      { _id: id, recipientId: req.user._id },
      { $set: { isRead: true } }
    );

    res.json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyNotifications,
  markAllAsRead,
  markOneAsRead,
};
