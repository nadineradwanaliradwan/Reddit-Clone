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
];

// ─── Routes ──────────────────────────────────────────────────────────────────

// List posts in a community — optionalProtect so private communities stay hidden from non-members.
// Path sits under /community/:name to keep it unambiguous with GET /:id.
router.get('/community/:name', optionalProtect, listPostsByCommunity);

// Fetch a single post by its Mongo ObjectId
router.get('/:id', optionalProtect, getPost);

// Author-only mutations
router.post('/',        protect, createPostValidation, createPost);
router.patch('/:id',    protect, updatePostValidation, updatePost);
router.delete('/:id',   protect, deletePost);

module.exports = router;
