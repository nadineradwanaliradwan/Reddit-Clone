const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: { validator: (v) => v.length === 2, message: 'A conversation must have exactly 2 participants' },
    },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: null },
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

// Enforce one conversation per participant pair regardless of order
conversationSchema.index({ participants: 1 }, { unique: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);