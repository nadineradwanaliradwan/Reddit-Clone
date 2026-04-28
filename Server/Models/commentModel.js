const mongoose = require('mongoose');

const MAX_BODY_LENGTH = 10000;
const MAX_DEPTH       = 7;

const commentSchema = new mongoose.Schema(
  {
    post: {
      type:      mongoose.Schema.Types.ObjectId,
      ref:       'Post',
      required:  true,
      immutable: true,
      index:     true,
    },
    author: {
      type:      mongoose.Schema.Types.ObjectId,
      ref:       'User',
      required:  true,
      immutable: true,
      index:     true,
    },
    // null → top-level comment; ObjectId → reply to that comment
    parent: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Comment',
      default: null,
      index:   true,
    },
    depth: {
      type:    Number,
      default: 0,
      min:     0,
      max:     MAX_DEPTH,
    },
    body: {
      type:      String,
      required:  [true, 'Comment body is required'],
      trim:      true,
      maxlength: [MAX_BODY_LENGTH, `Comment cannot exceed ${MAX_BODY_LENGTH} characters`],
    },
    // Resolved user IDs from @mentions in the body — stored so mention diffs on edit are possible later
    mentions: {
      type:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    isDeleted: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    deletedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

commentSchema.index({ post: 1, parent: 1, createdAt: 1 }); // primary listing
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });

// ─── toJSON ───────────────────────────────────────────────────────────────────

commentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  if (obj.isDeleted) {
    obj.body = '[deleted]';
    delete obj.deletedAt;
  }
  return obj;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const Comment = mongoose.model('Comment', commentSchema);
Comment.MAX_BODY_LENGTH = MAX_BODY_LENGTH;
Comment.MAX_DEPTH       = MAX_DEPTH;

module.exports = Comment;
