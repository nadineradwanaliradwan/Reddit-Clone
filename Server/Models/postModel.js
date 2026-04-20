const mongoose = require('mongoose');

// ─── Constants ────────────────────────────────────────────────────────────────

const POST_TYPES = ['text', 'link', 'image'];

// Reddit-style limits
const MAX_TITLE_LENGTH = 300;
const MAX_BODY_LENGTH  = 40000;

// Permissive URL regex — full validation happens in the express-validator layer
const URL_REGEX = /^https?:\/\/\S+$/i;

// ─── Post Schema ──────────────────────────────────────────────────────────────

const postSchema = new mongoose.Schema(
  {
    // Submitter — required and immutable (set at create, never changed)
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      immutable: true,
      index: true,
    },

    // Community the post belongs to — immutable after creation
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: [true, 'Community is required'],
      immutable: true,
      index: true,
    },

    // Post kind drives which of body / url / imageUrl is required
    type: {
      type: String,
      enum: {
        values: POST_TYPES,
        message: "Type must be one of 'text', 'link', or 'image'",
      },
      required: [true, 'Post type is required'],
      immutable: true, // switching type mid-life would invalidate the required-field rules
    },

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [MAX_TITLE_LENGTH, `Title cannot exceed ${MAX_TITLE_LENGTH} characters`],
    },

    // Only meaningful when type === 'text'
    body: {
      type: String,
      trim: true,
      maxlength: [MAX_BODY_LENGTH, `Body cannot exceed ${MAX_BODY_LENGTH} characters`],
      default: '',
      required: [
        function () { return this.type === 'text'; },
        'Text posts must include a body',
      ],
    },

    // Only meaningful when type === 'link'
    url: {
      type: String,
      trim: true,
      default: '',
      required: [
        function () { return this.type === 'link'; },
        'Link posts must include a URL',
      ],
      validate: {
        validator: function (v) {
          // Only enforce the format when this is a link post
          if (this.type !== 'link') return true;
          return URL_REGEX.test(v);
        },
        message: 'URL must be a valid http(s) URL',
      },
    },

    // Only meaningful when type === 'image'
    // Store a URL — image upload handling is intentionally out of scope for this slice
    imageUrl: {
      type: String,
      trim: true,
      default: '',
      required: [
        function () { return this.type === 'image'; },
        'Image posts must include an image URL',
      ],
      validate: {
        validator: function (v) {
          if (this.type !== 'image') return true;
          return URL_REGEX.test(v);
        },
        message: 'imageUrl must be a valid http(s) URL',
      },
    },

    // Soft delete — keeps the document so comments / references stay valid
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Set once when isDeleted flips to true — useful for audit / future cleanup jobs
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Feed query: "give me r/xxx's newest posts"
postSchema.index({ community: 1, isDeleted: 1, createdAt: -1 });

// Profile query: "give me this user's newest posts"
postSchema.index({ author: 1, createdAt: -1 });

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Never leak the soft-delete flag in a public payload; return a placeholder instead
postSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });

  if (obj.isDeleted) {
    // Redact user-visible content for deleted posts
    obj.title    = '[deleted]';
    obj.body     = '';
    obj.url      = '';
    obj.imageUrl = '';
  }

  delete obj.deletedAt;
  return obj;
};

const Post = mongoose.model('Post', postSchema);

// Attach constants so controllers/routes can reuse them without redefining limits
Post.POST_TYPES       = POST_TYPES;
Post.MAX_TITLE_LENGTH = MAX_TITLE_LENGTH;
Post.MAX_BODY_LENGTH  = MAX_BODY_LENGTH;

module.exports = Post;
