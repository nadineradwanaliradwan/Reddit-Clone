const mongoose = require('mongoose');

const commentVoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
      index: true,
    },
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  { timestamps: true },
);

commentVoteSchema.index({ user: 1, comment: 1 }, { unique: true });
commentVoteSchema.index({ comment: 1, value: 1 });

module.exports = mongoose.model('CommentVote', commentVoteSchema);
