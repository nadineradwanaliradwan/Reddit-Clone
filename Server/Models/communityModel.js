const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const ruleSchema = new mongoose.Schema(
  {
    title:           { type: String, required: true, trim: true, maxlength: 100 },
    body:            { type: String, trim: true, maxlength: 500, default: '' },
    violationReason: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { _id: true }
);

const flairSchema = new mongoose.Schema(
  {
    name:            { type: String, required: true, trim: true, maxlength: 64 },
    textColor:       { type: String, default: '#ffffff' },
    backgroundColor: { type: String, default: '#0079d3' },
  },
  { _id: true }
);

// ─── Community Schema ─────────────────────────────────────────────────────────

const communitySchema = new mongoose.Schema(
  {
    // Unique identifier — always stored lowercase (r/name)
    name: {
      type: String,
      required: [true, 'Community name is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3,  'Community name must be at least 3 characters'],
      maxlength: [21, 'Community name cannot exceed 21 characters'],
      match: [
        /^[a-z0-9_]+$/,
        'Community name can only contain letters, numbers, and underscores',
      ],
    },

    // Short tagline shown under the community name
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },

    // Full sidebar text (markdown supported on frontend)
    sidebar: {
      type: String,
      trim: true,
      maxlength: [10000, 'Sidebar text cannot exceed 10,000 characters'],
      default: '',
    },

    // Visibility & join model
    type: {
      type: String,
      enum: {
        values: ['public', 'restricted', 'private'],
        message: "Type must be 'public', 'restricted', or 'private'",
      },
      default: 'public',
    },

    // Who can submit posts
    allowedPostTypes: {
      type: String,
      enum: {
        values: ['any', 'text', 'link'],
        message: "Allowed post types must be 'any', 'text', or 'link'",
      },
      default: 'any',
    },

    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Cached count — incremented/decremented on join/leave
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Media
    icon:   { type: String, trim: true, default: '' },
    banner: { type: String, trim: true, default: '' },

    // Flags
    isNSFW:           { type: Boolean, default: false },
    spoilersEnabled:  { type: Boolean, default: true  },
    isArchived:       { type: Boolean, default: false },

    // Optional welcome message sent to new members
    welcomeMessage: {
      type: String,
      trim: true,
      maxlength: [5000, 'Welcome message cannot exceed 5,000 characters'],
      default: '',
    },

    rules:  { type: [ruleSchema],  default: [] },
    flairs: { type: [flairSchema], default: [] },
  },
  { timestamps: true }
);

// ─── Pre-save Hook ────────────────────────────────────────────────────────────

communitySchema.pre('save', function () {
  if (this.isModified('name')) this.name = this.name.toLowerCase();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

communitySchema.methods.isPubliclyVisible = function () {
  return this.type !== 'private';
};

communitySchema.methods.allowsViewingWithoutMembership = function () {
  return this.type === 'public' || this.type === 'restricted';
};

communitySchema.methods.allowsPostingWithoutMembership = function () {
  return false; // always requires membership to post
};

module.exports = mongoose.model('Community', communitySchema);
