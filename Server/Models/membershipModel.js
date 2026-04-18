const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
    },
    role: {
      type: String,
      enum: ['member', 'moderator'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Prevents a user from joining the same community twice
membershipSchema.index({ user: 1, community: 1 }, { unique: true });

// Efficient lookup for "get all communities this user joined" (feed page later)
membershipSchema.index({ user: 1, joinedAt: -1 });

module.exports = mongoose.model('Membership', membershipSchema);
