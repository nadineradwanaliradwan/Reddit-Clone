const mongoose = require('mongoose');

const NOTIFICATION_TYPES = ['post_comment', 'comment_reply', 'mention'];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    // The user whose action triggered this notification
    actor: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    type: {
      type:     String,
      enum:     { values: NOTIFICATION_TYPES, message: 'Invalid notification type' },
      required: true,
    },
    post:      { type: mongoose.Schema.Types.ObjectId, ref: 'Post',      default: null },
    comment:   { type: mongoose.Schema.Types.ObjectId, ref: 'Comment',   default: null },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null },
    isRead:    { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// ─── Constants ────────────────────────────────────────────────────────────────

const Notification = mongoose.model('Notification', notificationSchema);
Notification.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

module.exports = Notification;
