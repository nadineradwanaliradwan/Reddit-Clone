const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../Middlewares/authMiddleware');
const { optionalProtect } = require('../Middlewares/optionalProtect');
const Comment = require('../Models/commentModel');
const {
  listComments,
  createComment,
  createReply,
  updateComment,
  deleteComment,
  saveComment,
  unsaveComment,
  listSavedComments,
} = require('../Controllers/commentController');

// ─── Validation rules ────────────────────────────────────────────────────────

const commentBodyValidation = [
  body('body')
    .trim()
    .notEmpty().withMessage('Comment body is required')
    .isLength({ max: Comment.MAX_BODY_LENGTH })
    .withMessage(`Comment cannot exceed ${Comment.MAX_BODY_LENGTH} characters`),
];

// ─── Post-scoped router ──────────────────────────────────────────────────────
// Mounted at /reddit/posts/:postId/comments — mergeParams exposes :postId

const postScopedRouter = express.Router({ mergeParams: true });

postScopedRouter.get('/',  optionalProtect, listComments);
postScopedRouter.post('/', protect, commentBodyValidation, createComment);

// ─── Comment router ───────────────────────────────────────────────────────────
// Mounted at /reddit/comments
// IMPORTANT: specific sub-paths before /:id to prevent param shadowing

const commentRouter = express.Router();

commentRouter.get('/saved',         protect, listSavedComments);
commentRouter.post('/:id/reply',    protect, commentBodyValidation, createReply);
commentRouter.post('/:id/save',     protect, saveComment);
commentRouter.delete('/:id/save',   protect, unsaveComment);
commentRouter.patch('/:id',         protect, commentBodyValidation, updateComment);
commentRouter.delete('/:id',        protect, deleteComment);

module.exports = { postScopedRouter, commentRouter };
