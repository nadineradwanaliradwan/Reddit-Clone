const { validationResult } = require('express-validator');
const User = require('../Models/authModel');
const Community = require('../Models/communityModel');
const Membership = require('../Models/membershipModel');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const getSearchRegex = (q) => new RegExp(escapeRegExp(q.trim()), 'i');

// ─── @route  GET /reddit/search/users?q= ─────────────────────────────────────
// ─── @access Public ──────────────────────────────────────────────────────────
const searchUsers = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const query = req.query.q.trim();
  const { page, limit, skip } = getPagination(req.query);

  try {
    const filter = {
      isActive: true,
      username: getSearchRegex(query),
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('_id username createdAt')
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      query,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── @route  GET /reddit/search/communities?q= ───────────────────────────────
// ─── @access Public (private communities: members only) ──────────────────────
const searchCommunities = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const query = req.query.q.trim();
  const { page, limit, skip } = getPagination(req.query);
  const regex = getSearchRegex(query);

  try {
    const visibility = [{ type: { $in: ['public', 'restricted'] } }];

    if (req.user) {
      const memberships = await Membership.find({ user: req.user.id }).select('community');
      const memberCommunityIds = memberships.map(membership => membership.community);
      if (memberCommunityIds.length > 0)
        visibility.push({ _id: { $in: memberCommunityIds } });
    }

    const filter = {
      $and: [
        { $or: [{ name: regex }, { description: regex }] },
        { $or: visibility },
      ],
    };

    const [communities, total] = await Promise.all([
      Community.find(filter)
        .select('_id name description type memberCount icon banner isNSFW createdAt')
        .sort({ memberCount: -1, name: 1 })
        .skip(skip)
        .limit(limit),
      Community.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      query,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      communities,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { searchUsers, searchCommunities };
