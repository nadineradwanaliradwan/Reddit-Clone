const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../Middlewares/authMiddleware');
const { optionalProtect } = require('../Middlewares/optionalProtect');
const { createCommunity, joinCommunity, leaveCommunity, getCommunity } = require('../Controllers/communityController');

const router = express.Router();



// ─── Routes ──────────────────────────────────────────────────────────────────
// Get community details by name (optional authentication)
router.get('/:name',optionalProtect, getCommunity); // tested
router.post('/',protect, createCommunity); //tested
router.post('/:name/join', protect, joinCommunity); 
router.post('/:name/leave', protect, leaveCommunity);

module.exports = router;

