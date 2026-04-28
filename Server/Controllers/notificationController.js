const mongoose = require('mongoose');
const Notification = require('../Models/notificationModel');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

const isValidObjectId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// ─── @route  GET /reddit/notifications ───────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const listNotifications = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
  const skip  = (page - 1) * limit;

  try {
    const filter = { recipient: req.user.id };

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor',   'username')
        .populate('post',    'title')
        .populate('comment', 'body'),
      Notification.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      notifications,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /reddit/notifications/unread-count ──────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.id, isRead: false });
    res.status(200).json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  PATCH /reddit/notifications/:id/read ────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const markAsRead = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Notification not found' });

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user.id },
      { $set: { isRead: true } },
      { new: true },
    );

    if (!notification)
      return res.status(404).json({ success: false, message: 'Notification not found' });

    res.status(200).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  PATCH /reddit/notifications/read-all ────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } },
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      count: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  DELETE /reddit/notifications/:id ────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const deleteNotification = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(404).json({ success: false, message: 'Notification not found' });

  try {
    const result = await Notification.deleteOne({ _id: id, recipient: req.user.id });

    if (result.deletedCount === 0)
      return res.status(404).json({ success: false, message: 'Notification not found' });

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
