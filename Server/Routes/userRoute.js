const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../Middlewares/authMiddleware');
const { optionalProtect } = require('../Middlewares/optionalProtect');
const { updateProfile, changePassword, getUserPosts, getUserProfile, followUser, unfollowUser } = require('../Controllers/userController');

const router = express.Router();

const profileValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
];

const passwordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];

// Protected routes (protect applied globally at app level)
router.patch('/me', profileValidation, updateProfile);
router.patch('/me/password', passwordValidation, changePassword);
router.post('/:username/follow', followUser);
router.delete('/:username/follow', unfollowUser);

module.exports = router;

// ─── Public user routes (no auth required) ───────────────────────────────────
const publicRouter = express.Router();
// Order matters: more specific paths before /:username
publicRouter.get('/:username/posts', optionalProtect, getUserPosts);
publicRouter.get('/:username', optionalProtect, getUserProfile);
module.exports.publicRouter = publicRouter;
