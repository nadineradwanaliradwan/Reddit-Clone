const mongoose = require('mongoose');

// ─── SavedPost Schema ─────────────────────────────────────────────────────────
//
// Join collection between User and Post for the "saved posts" feature.
// We use a separate collection (rather than an array on User) so:
//   - Each save carries its own `savedAt` timestamp, enabling "recently saved" sort
//   - User documents stay small even for power users who save thousands of posts
//   - A unique compound index on (user, post) prevents duplicate saves at the DB level

const savedPostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    // When the user saved the post — used to sort the "saved" feed newest-first
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Prevents the same user from saving the same post twice
savedPostSchema.index({ user: 1, post: 1 }, { unique: true });

// Efficient lookup for "this user's saves, newest first" — drives the saved feed
savedPostSchema.index({ user: 1, savedAt: -1 });

module.exports = mongoose.model('SavedPost', savedPostSchema);
