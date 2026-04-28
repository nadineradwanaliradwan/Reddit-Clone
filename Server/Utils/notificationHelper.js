const Notification = require('../Models/notificationModel');
const User = require('../Models/authModel');

const MAX_MENTIONS = 10;
const MENTION_RE   = /@([a-zA-Z0-9_]{3,30})/g;

// ─── createNotification ───────────────────────────────────────────────────────
// Fire-and-forget helper. Never throws — notification failures must never block
// the action that triggered them.
// data: { recipient, actor, type, post?, comment?, community? }
const createNotification = async (data) => {
  try {
    // Never notify a user about their own action
    if (String(data.recipient) === String(data.actor)) return null;
    return await Notification.create(data);
  } catch {
    return null;
  }
};

// ─── extractMentions ──────────────────────────────────────────────────────────
// Parse @username mentions from body text, resolve to User _ids.
// Returns an array of ObjectIds (up to MAX_MENTIONS, deduplicated).
const extractMentions = async (bodyText) => {
  const raw = [...bodyText.matchAll(MENTION_RE)].map(m => m[1].toLowerCase());
  const unique = [...new Set(raw)].slice(0, MAX_MENTIONS);
  if (unique.length === 0) return [];

  const users = await User.find({
    username: { $in: unique.map(n => new RegExp(`^${n}$`, 'i')) },
  }).select('_id');

  return users.map(u => u._id);
};

module.exports = { createNotification, extractMentions };
