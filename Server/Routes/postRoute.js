const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../Middlewares/authMiddleware');
const { optionalProtect } = require('../Middlewares/optionalProtect');
const Post = require('../Models/postModel');
const {
  createPost,
  getPost,
  listPostsByCommunity,
  updatePost,
  deletePost,
  listFeed,
  savePost,
  unsavePost,
} = require('../Controllers/postController');

const router = express.Router();

// ─── Validation Rules ─────────────────────────────────────────────────────────

const createPostValidation = [
  body('community')
    .trim()
    .notEmpty().withMessage('Community name is required')
    .isLength({ min: 3, max: 21 }).withMessage('Community name must be 3–21 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Invalid community name'),

  body('type')
    .trim()
    .notEmpty().withMessage('Post type is required')
    .isIn(Post.POST_TYPES).withMessage(`Type must be one of ${Post.POST_TYPES.join(', ')}`),

  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: Post.MAX_TITLE_LENGTH })
    .withMessage(`Title cannot exceed ${Post.MAX_TITLE_LENGTH} characters`),

  // body is only required for text posts
  body('body')
    .if(body('type').equals('text'))
    .trim()
    .notEmpty().withMessage('Text posts must include a body')
    .isLength({ max: Post.MAX_BODY_LENGTH })
    .withMessage(`Body cannot exceed ${Post.MAX_BODY_LENGTH} characters`),

  // url is only required (and only validated) for link posts
  body('url')
    .if(body('type').equals('link'))
    .trim()
    .notEmpty().withMessage('Link posts must include a URL')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('URL must be a valid http(s) URL'),

  // imageUrl is only required (and only validated) for image posts
  body('imageUrl')
    .if(body('type').equals('image'))
    .trim()
    .notEmpty().withMessage('Image posts must include an image URL')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('imageUrl must be a valid http(s) URL'),

  // Optional flair id — the controller confirms it actually belongs to the target community
  body('flair')
    .optional({ nullable: true })
    .isMongoId().withMessage('Flair must be a valid id'),
];

// Update doesn't let you change type — only the content fields corresponding to the stored type.
// We validate upper bounds / URL format when the field is present; the controller decides what to apply.
const updatePostValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: Post.MAX_TITLE_LENGTH })
    .withMessage(`Title cannot exceed ${Post.MAX_TITLE_LENGTH} characters`),

  body('body')
    .optional()
    .trim()
    .notEmpty().withMessage('Body cannot be empty')
    .isLength({ max: Post.MAX_BODY_LENGTH })
    .withMessage(`Body cannot exceed ${Post.MAX_BODY_LENGTH} characters`),

  body('url')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('URL must be a valid http(s) URL'),

  body('imageUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('imageUrl must be a valid http(s) URL'),

  // Flair can be set (mongo id), cleared (null or empty string), or left alone (omitted).
  // Only validate format when it's a non-empty string.
  body('flair')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === '' || value === null) return true;
      // Defer to isMongoId-style check
      return /^[a-f\d]{24}$/i.test(String(value));
    })
    .withMessage('Flair must be a valid id, null, or empty string'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────
//
// IMPORTANT: more specific paths (`/feed`, `/community/:name`, `/:id/save`)
// must be registered BEFORE the catch-all `/:id` routes, or Express will
// interpret `feed` / `save` as a post id and dispatch to the wrong handler.

// ── Feed (home / popular / saved) ───────────────────────────────────────────
// optionalProtect lets anonymous users hit `?scope=popular`; the controller
// rejects anonymous home/saved requests with 401.
router.get('/feed', optionalProtect, listFeed);

// ── Community feed ──────────────────────────────────────────────────────────
router.get('/community/:name', optionalProtect, listPostsByCommunity);

// ── Save / unsave ──────────────────────────────────────────────────────────
// Sub-paths of `/:id`, so they MUST come before the bare `/:id` routes below.
router.post('/:id/save',   protect, savePost);
router.delete('/:id/save', protect, unsavePost);

// ── Single post ────────────────────────────────────────────────────────────
router.get('/:id', optionalProtect, getPost);

// ── Author-only mutations ──────────────────────────────────────────────────
router.post('/',        protect, createPostValidation, createPost);//tested
router.patch('/:id',    protect, updatePostValidation, updatePost);//tested
router.delete('/:id',   protect, deletePost);//tested

module.exports = router;
