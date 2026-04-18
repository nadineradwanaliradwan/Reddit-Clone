const { validationResult } = require('express-validator');
const Community = require('../Models/communityModel');
const Membership = require('../Models/membershipModel');

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RULES  = 15;
const MAX_FLAIRS = 100;

// Names that could cause confusion or security issues
const RESERVED_NAMES = new Set([
  'admin', 'api', 'reddit', 'mod', 'mods', 'moderator', 'moderators',
  'login', 'logout', 'register', 'signup', 'signin', 'settings',
  'account', 'profile', 'user', 'users', 'search', 'explore',
  'feed', 'home', 'popular', 'all', 'random', 'undefined', 'null',
  'help', 'about', 'contact', 'terms', 'privacy', 'rules',
  'support', 'blog', 'jobs', 'store', 'premium', 'gold',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validateName = (name) => {
  const lower = name.toLowerCase();

  if (RESERVED_NAMES.has(lower))
    return 'That community name is reserved and cannot be used';

  if (lower.startsWith('_') || lower.endsWith('_'))
    return 'Community name cannot start or end with an underscore';

  if (/__/.test(lower))
    return 'Community name cannot contain consecutive underscores';

  return null;
};

// ─── @route  POST /reddit/communities ────────────────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const createCommunity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const {
    name,
    description,
    sidebar,
    type,
    allowedPostTypes,
    isNSFW,
    welcomeMessage,
    rules   = [],
    flairs  = [],
  } = req.body;

  // ── Business logic validations ──────────────────────────────────────────────

  const nameError = validateName(name);
  if (nameError)
    return res.status(400).json({ success: false, message: nameError });

  if (rules.length > MAX_RULES)
    return res.status(400).json({ success: false, message: `Communities can have at most ${MAX_RULES} rules` });

  if (flairs.length > MAX_FLAIRS)
    return res.status(400).json({ success: false, message: `Communities can have at most ${MAX_FLAIRS} flairs` });

  // Each rule must have a non-empty title
  for (let i = 0; i < rules.length; i++) {
    if (!rules[i].title || !rules[i].title.trim())
      return res.status(400).json({ success: false, message: `Rule ${i + 1} is missing a title` });
  }

  // Each flair must have a non-empty name
  for (let i = 0; i < flairs.length; i++) {
    if (!flairs[i].name || !flairs[i].name.trim())
      return res.status(400).json({ success: false, message: `Flair ${i + 1} is missing a name` });
  }

  try {
    const existing = await Community.findOne({ name: name.toLowerCase() });
    if (existing)
      return res.status(409).json({ success: false, message: 'A community with that name already exists' });

    const community = await Community.create({
      name,
      description,
      sidebar,
      type,
      allowedPostTypes,
      isNSFW,
      welcomeMessage,
      rules,
      flairs,
      creator: req.user.id,
      memberCount: 0,
    });

    // Make the creator a moderator — roll back the whole community if this fails
    try {
      await Membership.create({
        user: req.user.id,
        community: community._id,
        role: 'moderator',
      });
    } catch {
      await Community.findByIdAndDelete(community._id);
      return res.status(500).json({ success: false, message: 'Failed to initialize community membership' });
    }

    await Community.findByIdAndUpdate(community._id, { $inc: { memberCount: 1 } });

    const populated = await Community.findById(community._id).populate('creator', 'username');

    res.status(201).json({
      success: true,
      message: 'Community created successfully',
      community: populated,
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'A community with that name already exists' });
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  POST /reddit/communities/:name/join ─────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findOne({ name: req.params.name.toLowerCase() });

    if (!community)
      return res.status(404).json({ success: false, message: 'Community not found' });

    // Private communities require an invitation — joining directly is not allowed
    if (community.type === 'private')
      return res.status(403).json({ success: false, message: 'This is a private community. You need an invitation to join' });

    if (community.isArchived)
      return res.status(403).json({ success: false, message: 'This community is archived and no longer accepts new members' });

    // Prevent the creator from double-joining (they are already a moderator/member)
    if (community.creator.equals(req.user.id))
      return res.status(409).json({ success: false, message: 'You are already a member of this community' });

    await Membership.create({ user: req.user.id, community: community._id });

    await Community.findByIdAndUpdate(community._id, { $inc: { memberCount: 1 } });

    res.status(200).json({ success: true, message: `Successfully joined r/${community.name}` });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'You are already a member of this community' });
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  POST /reddit/communities/:name/leave ────────────────────────────
// ─── @access Private ─────────────────────────────────────────────────────────
const leaveCommunity = async (req, res) => {
  try {
    const community = await Community.findOne({ name: req.params.name.toLowerCase() });

    if (!community)
      return res.status(404).json({ success: false, message: 'Community not found' });

    // Creator must transfer ownership before leaving
    if (community.creator.equals(req.user.id))
      return res.status(403).json({ success: false, message: 'The community creator cannot leave. Transfer ownership or delete the community instead' });

    const membership = await Membership.findOneAndDelete({
      user: req.user.id,
      community: community._id,
    });

    if (!membership)
      return res.status(404).json({ success: false, message: 'You are not a member of this community' });

    // Never let memberCount go below 0 from a race condition or data drift
    await Community.findByIdAndUpdate(community._id, {
      $inc: { memberCount: -1 },
      ...(community.memberCount <= 1 && { $set: { memberCount: 0 } }),
    });

    res.status(200).json({ success: true, message: `Successfully left r/${community.name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /reddit/communities/:name ───────────────────────────────────
// ─── @access Public (private communities: members only) ──────────────────────
const getCommunity = async (req, res) => {
  try {
    const community = await Community.findOne({ name: req.params.name.toLowerCase() })
      .populate('creator', 'username');

    if (!community)
      return res.status(404).json({ success: false, message: 'Community not found' });

    if (community.type === 'private') {
      // Return 404 (not 403) — don't reveal that a private community exists
      if (!req.user)
        return res.status(404).json({ success: false, message: 'Community not found' });

      const membership = await Membership.findOne({
        user: req.user.id,
        community: community._id,
      });

      if (!membership)
        return res.status(404).json({ success: false, message: 'Community not found' });
    }

    res.status(200).json({ success: true, community });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { createCommunity, joinCommunity, leaveCommunity, getCommunity };
