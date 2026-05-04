const { validationResult } = require('express-validator');
const User = require('../Models/authModel');
const Community = require('../Models/communityModel');
const Membership = require('../Models/membershipModel');
const Post = require('../Models/postModel');
const Follow = require('../Models/followModel');

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

    let followingSet = new Set();
    if (req.user && users.length) {
      const follows = await Follow.find({
        follower: req.user.id,
        following: { $in: users.map(u => u._id) },
      }).select('following');
      followingSet = new Set(follows.map(f => String(f.following)));
    }

    const usersWithFollow = users.map(u => ({
      _id: u._id,
      username: u.username,
      createdAt: u.createdAt,
      isFollowing: followingSet.has(String(u._id)),
    }));

    res.status(200).json({
      success: true,
      query,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      users: usersWithFollow,
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

// ─── @route  GET /reddit/search/posts?q= ─────────────────────────────────────
// ─── @access Public ──────────────────────────────────────────────────────────
const searchPosts = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const query = req.query.q.trim();
  const { page, limit, skip } = getPagination(req.query);
  const regex = getSearchRegex(query);

  try {
    const filter = {
      isDeleted: false,
      $or: [{ title: regex }, { body: regex }],
    };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ score: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username')
        .populate('community', 'name type'),
      Post.countDocuments(filter),
    ]);

    // Exclude posts from private communities the user isn't a member of
    let visiblePosts = posts;
    if (posts.some(p => p.community?.type === 'private')) {
      let memberCommunityIds = new Set();
      if (req.user) {
        const memberships = await Membership.find({ user: req.user.id }).select('community');
        memberCommunityIds = new Set(memberships.map(m => String(m.community)));
      }
      visiblePosts = posts.filter(p =>
        !p.community || p.community.type !== 'private' || memberCommunityIds.has(String(p.community._id))
      );
    }

    res.status(200).json({
      success: true,
      query,
      page,
      limit,
      total: visiblePosts.length,
      totalPages: Math.ceil(total / limit),
      posts: visiblePosts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { searchUsers, searchCommunities, searchPosts };
