const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Community = require('../Models/communityModel');
const Membership = require('../Models/membershipModel');
const Post = require('../Models/postModel');

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

// ─── Flair management helpers ────────────────────────────────────────────────

const isValidObjectId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// Permissive hex-color check — accepts #rgb, #rrggbb, or #rrggbbaa
const isHexColor = (s) => typeof s === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s);

// Resolve the community by name and confirm the caller is a moderator.
// Returns { community, error } where `error` is a ready-to-send { status, body } on failure.
const loadCommunityAsModerator = async (name, userId) => {
  const community = await Community.findOne({ name: String(name).toLowerCase() });
  if (!community)
    return { error: { status: 404, body: { success: false, message: 'Community not found' } } };

  const membership = await Membership.findOne({ user: userId, community: community._id });
  if (!membership || membership.role !== 'moderator')
    return { error: { status: 403, body: { success: false, message: 'Only moderators can manage flairs' } } };

  return { community };
};

// ─── @route  POST /reddit/communities/:name/flairs ───────────────────────────
// ─── @access Private (moderators only) ───────────────────────────────────────
const createFlair = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { name: flairName, textColor, backgroundColor } = req.body;

  try {
    const { community, error } = await loadCommunityAsModerator(req.params.name, req.user.id);
    if (error) return res.status(error.status).json(error.body);

    if (community.flairs.length >= MAX_FLAIRS)
      return res.status(400).json({
        success: false,
        message: `Communities can have at most ${MAX_FLAIRS} flairs`,
      });

    // Reject duplicate flair names (case-insensitive) within the same community —
    // two flairs called "News" would be confusing to pick from in a UI.
    const trimmedName = flairName.trim();
    const duplicate = community.flairs.some(
      f => f.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate)
      return res.status(409).json({ success: false, message: 'A flair with that name already exists' });

    const flair = { name: trimmedName };
    if (textColor)       flair.textColor = textColor;
    if (backgroundColor) flair.backgroundColor = backgroundColor;

    community.flairs.push(flair);
    await community.save();

    // The just-pushed flair is the last element; Mongoose assigned it an _id on save.
    const created = community.flairs[community.flairs.length - 1];

    res.status(201).json({ success: true, message: 'Flair created', flair: created });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  PATCH /reddit/communities/:name/flairs/:flairId ─────────────────
// ─── @access Private (moderators only) ───────────────────────────────────────
const updateFlair = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { flairId } = req.params;
  if (!isValidObjectId(flairId))
    return res.status(404).json({ success: false, message: 'Flair not found' });

  const { name: flairName, textColor, backgroundColor } = req.body;

  try {
    const { community, error } = await loadCommunityAsModerator(req.params.name, req.user.id);
    if (error) return res.status(error.status).json(error.body);

    const flair = community.flairs.id(flairId);
    if (!flair)
      return res.status(404).json({ success: false, message: 'Flair not found' });

    // Name change needs the same uniqueness check as create — but ignore the flair we're editing
    if (typeof flairName === 'string') {
      const trimmed = flairName.trim();
      if (!trimmed)
        return res.status(400).json({ success: false, message: 'Flair name cannot be empty' });

      const clashes = community.flairs.some(
        f => !f._id.equals(flair._id) && f.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (clashes)
        return res.status(409).json({ success: false, message: 'A flair with that name already exists' });

      flair.name = trimmed;
    }

    if (typeof textColor === 'string')       flair.textColor = textColor;
    if (typeof backgroundColor === 'string') flair.backgroundColor = backgroundColor;

    await community.save();

    res.status(200).json({ success: true, message: 'Flair updated', flair });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  DELETE /reddit/communities/:name/flairs/:flairId ────────────────
// ─── @access Private (moderators only) ───────────────────────────────────────
const deleteFlair = async (req, res) => {
  const { flairId } = req.params;
  if (!isValidObjectId(flairId))
    return res.status(404).json({ success: false, message: 'Flair not found' });

  try {
    const { community, error } = await loadCommunityAsModerator(req.params.name, req.user.id);
    if (error) return res.status(error.status).json(error.body);

    const flair = community.flairs.id(flairId);
    if (!flair)
      return res.status(404).json({ success: false, message: 'Flair not found' });

    // Using .pull to remove the subdoc by _id — cleaner than filtering the array by hand
    community.flairs.pull(flairId);
    await community.save();

    // Posts that referenced this flair would now point at a non-existent subdoc,
    // which would confuse the ?flair=<id> filter and the read path. Null them out
    // so the posts themselves remain intact but become unflaired.
    await Post.updateMany(
      { community: community._id, flair: flairId },
      { $set: { flair: null } },
    );

    res.status(200).json({ success: true, message: 'Flair deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = {
  createCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunity,
  createFlair,
  updateFlair,
  deleteFlair,
};
