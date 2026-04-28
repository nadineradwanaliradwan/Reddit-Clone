const mongoose = require('mongoose');

const savedCommentSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true, index: true },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

savedCommentSchema.index({ user: 1, comment: 1 }, { unique: true });
savedCommentSchema.index({ user: 1, savedAt: -1 });

module.exports = mongoose.model('SavedComment', savedCommentSchema);
