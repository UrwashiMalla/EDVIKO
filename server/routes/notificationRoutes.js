const express = require("express");
const router = express.Router();
const {
  getMyNotifications,
  markAllAsRead,
  markOneAsRead,
} = require("../controllers/notificationController");
const { authenticate } = require("../middleware/authMiddleware");

router.use(authenticate);

router.get("/", getMyNotifications);
router.put("/mark-all-read", markAllAsRead);
router.put("/:id/read", markOneAsRead);

module.exports = router;
