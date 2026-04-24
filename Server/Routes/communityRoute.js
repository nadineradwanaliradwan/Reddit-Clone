const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../Middlewares/authMiddleware');
const { optionalProtect } = require('../Middlewares/optionalProtect');
const {
  createCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunity,
  createFlair,
  updateFlair,
  deleteFlair,
} = require('../Controllers/communityController');

const router = express.Router();

// ─── Validation rules ────────────────────────────────────────────────────────

// Accepts #rgb, #rrggbb, or #rrggbbaa — matches the controller's isHexColor
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const createFlairValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Flair name is required')
    .isLength({ max: 64 }).withMessage('Flair name cannot exceed 64 characters'),

  body('textColor')
    .optional()
    .matches(HEX_COLOR_RE).withMessage('textColor must be a hex color like #ffffff'),

  body('backgroundColor')
    .optional()
    .matches(HEX_COLOR_RE).withMessage('backgroundColor must be a hex color like #0079d3'),
];

// Update: every field optional, but if present must still pass its rule
const updateFlairValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Flair name cannot be empty')
    .isLength({ max: 64 }).withMessage('Flair name cannot exceed 64 characters'),

  body('textColor')
    .optional()
    .matches(HEX_COLOR_RE).withMessage('textColor must be a hex color like #ffffff'),

  body('backgroundColor')
    .optional()
    .matches(HEX_COLOR_RE).withMessage('backgroundColor must be a hex color like #0079d3'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────
// Get community details by name (optional authentication)
router.get('/:name',optionalProtect, getCommunity); // tested
router.post('/',protect, createCommunity); //tested
router.post('/:name/join', protect, joinCommunity);
router.post('/:name/leave', protect, leaveCommunity);

// Flair management — moderator-only (enforced in the controller)
router.post('/:name/flairs',               protect, createFlairValidation, createFlair);
router.patch('/:name/flairs/:flairId',     protect, updateFlairValidation, updateFlair);
router.delete('/:name/flairs/:flairId',    protect, deleteFlair);

module.exports = router;

