const mongoose = require('mongoose');

const postVoteSchema = new mongoose.Schema(
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
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  { timestamps: true },
);

postVoteSchema.index({ user: 1, post: 1 }, { unique: true });
postVoteSchema.index({ post: 1, value: 1 });

module.exports = mongoose.model('PostVote', postVoteSchema);
