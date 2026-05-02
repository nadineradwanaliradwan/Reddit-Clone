const express = require('express');
const { query } = require('express-validator');
const { optionalProtect } = require('../Middlewares/optionalProtect');
const { searchUsers, searchCommunities } = require('../Controllers/searchController');

const router = express.Router();

const searchValidation = [
  query('q')
    .trim()
    .notEmpty().withMessage('Search query is required')
    .isLength({ max: 50 }).withMessage('Search query cannot exceed 50 characters'),
];

router.get('/users', optionalProtect, searchValidation, searchUsers);
router.get('/communities', optionalProtect, searchValidation, searchCommunities);

module.exports = router;
