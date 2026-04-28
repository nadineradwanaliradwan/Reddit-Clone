const express = require('express');
const {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../Controllers/notificationController');

const router = express.Router();

// Specific paths before /:id to avoid param shadowing
router.get('/',             listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all',   markAllAsRead);
router.patch('/:id/read',   markAsRead);
router.delete('/:id',       deleteNotification);

module.exports = router;
