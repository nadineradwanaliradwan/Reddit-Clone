process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-access-secret-12345678901234567890';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-12345678901234567890';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.RESEND_API_KEY = 're_test_123456789';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';
process.env.CLIENT_URL = 'http://localhost:5173';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index');
const User = require('../Models/authModel');

jest.setTimeout(120000);

let mongoServer;
let uniqueCounter = 0;

const nextTag = (prefix) => {
  uniqueCounter += 1;
  return `${prefix}${Date.now()}${uniqueCounter}`;
};

const nextCommunityName = (prefix = 'c') => {
  uniqueCounter += 1;
  return `${prefix.slice(0, 8)}${Date.now().toString(36).slice(-6)}${uniqueCounter.toString(36)}`.toLowerCase();
};

const registerUser = async (prefix = 'user') => {
  const tag = nextTag(prefix).toLowerCase();
  const payload = {
    username: tag,
    email: `${tag}@example.com`,
    password: 'Password123!',
  };

  const res = await request(app)
    .post('/reddit/auth/register')
    .send(payload)
    .expect(201);

  return {
    ...payload,
    id: res.body.user._id,
    token: res.body.accessToken,
  };
};

const createCommunity = async (token, overrides = {}) => {
  const name = (overrides.name || nextCommunityName()).toLowerCase();
  const body = {
    name,
    description: overrides.description || `${name} description`,
    type: overrides.type || 'public',
    allowedPostTypes: overrides.allowedPostTypes || 'any',
  };

  const res = await request(app)
    .post('/reddit/communities')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(201);

  return res.body.community;
};

const joinCommunity = (token, name) =>
  request(app)
    .post(`/reddit/communities/${name}/join`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

const createPost = async (token, community, overrides = {}) => {
  const res = await request(app)
    .post('/reddit/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      community,
      type: 'text',
      title: overrides.title || `Post ${nextTag('title')}`,
      body: overrides.body || 'Body text',
      ...overrides,
    })
    .expect(201);

  return res.body.post;
};

const createComment = async (token, postId, body = 'A useful comment') => {
  const res = await request(app)
    .post(`/reddit/posts/${postId}/comments`)
    .set('Authorization', `Bearer ${token}`)
    .send({ body })
    .expect(201);

  return res.body.comment;
};

const createReply = async (token, commentId, body = 'A useful reply') => {
  const res = await request(app)
    .post(`/reddit/comments/${commentId}/reply`)
    .set('Authorization', `Bearer ${token}`)
    .send({ body })
    .expect(201);

  return res.body.comment;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  await mongoose.connect(mongoServer.getUri(), { dbName: 'Reddit_Clone_Test' });
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map(collection => collection.deleteMany({})));
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('post voting', () => {
  test('requires authentication and hides invalid, deleted, or inaccessible posts', async () => {
    const owner = await registerUser('voteowner');
    const voter = await registerUser('votevoter');
    const community = await createCommunity(owner.token);
    const post = await createPost(owner.token, community.name);

    await request(app)
      .post(`/reddit/posts/${post._id}/upvote`)
      .expect(401);

    await request(app)
      .post('/reddit/posts/not-a-valid-id/upvote')
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(404);

    await request(app)
      .delete(`/reddit/posts/${post._id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    await request(app)
      .post(`/reddit/posts/${post._id}/upvote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(404);

    const privateCommunity = await createCommunity(owner.token, {
      name: nextCommunityName('private'),
      type: 'private',
    });
    const privatePost = await createPost(owner.token, privateCommunity.name);

    await request(app)
      .post(`/reddit/posts/${privatePost._id}/upvote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(404);
  });

  test('toggles and switches votes while surfacing userVote on post and feed responses', async () => {
    const owner = await registerUser('toggleowner');
    const voter = await registerUser('togglevoter');
    const community = await createCommunity(owner.token);
    const post = await createPost(owner.token, community.name);

    let res = await request(app)
      .post(`/reddit/posts/${post._id}/upvote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);
    expect(res.body).toMatchObject({ upvotes: 1, downvotes: 0, score: 1, userVote: 1 });

    res = await request(app)
      .get(`/reddit/posts/${post._id}`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);
    expect(res.body.post).toMatchObject({ upvotes: 1, downvotes: 0, score: 1, userVote: 1 });

    res = await request(app)
      .get(`/reddit/posts/${post._id}`)
      .expect(200);
    expect(res.body.post).toMatchObject({ upvotes: 1, downvotes: 0, score: 1, userVote: 0 });

    res = await request(app)
      .post(`/reddit/posts/${post._id}/upvote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);
    expect(res.body).toMatchObject({ upvotes: 0, downvotes: 0, score: 0, userVote: 0 });

    res = await request(app)
      .post(`/reddit/posts/${post._id}/downvote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);
    expect(res.body).toMatchObject({ upvotes: 0, downvotes: 1, score: -1, userVote: -1 });

    res = await request(app)
      .post(`/reddit/posts/${post._id}/upvote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);
    expect(res.body).toMatchObject({ upvotes: 1, downvotes: 0, score: 1, userVote: 1 });

    res = await request(app)
      .get('/reddit/posts/feed?scope=popular')
      .set('Authorization', `Bearer ${voter.token}`)
      .expect(200);
    expect(res.body.posts[0]).toMatchObject({ _id: post._id, upvotes: 1, downvotes: 0, score: 1, userVote: 1 });
  });
});

describe('comments', () => {
  test('creates, lists, replies, edits, deletes, and saves comments', async () => {
    const owner = await registerUser('commentowner');
    const member = await registerUser('commentmember');
    const outsider = await registerUser('commentoutsider');
    const community = await createCommunity(owner.token);
    const post = await createPost(owner.token, community.name);

    await request(app)
      .post(`/reddit/posts/${post._id}/comments`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ body: 'I should not be allowed yet' })
      .expect(403);

    await joinCommunity(member.token, community.name);

    let res = await request(app)
      .get(`/reddit/posts/${post._id}/comments`)
      .expect(200);
    expect(res.body).toMatchObject({ success: true, total: 0 });

    const comment = await createComment(member.token, post._id, `Hello @${owner.username}`);
    expect(comment).toMatchObject({ body: `Hello @${owner.username}`, depth: 0 });

    const reply = await createReply(owner.token, comment._id, 'Thanks for the note');
    expect(reply.depth).toBe(1);
    expect(String(reply.parent)).toBe(comment._id);

    res = await request(app)
      .get(`/reddit/posts/${post._id}/comments`)
      .expect(200);
    expect(res.body.total).toBe(2);

    res = await request(app)
      .patch(`/reddit/comments/${comment._id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ body: 'Edited comment' })
      .expect(200);
    expect(res.body.comment.body).toBe('Edited comment');

    await request(app)
      .patch(`/reddit/comments/${comment._id}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ body: 'Bad edit' })
      .expect(403);

    await request(app)
      .post(`/reddit/comments/${reply._id}/save`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(201);

    res = await request(app)
      .post(`/reddit/comments/${reply._id}/save`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);
    expect(res.body.alreadySaved).toBe(true);

    res = await request(app)
      .get('/reddit/comments/saved')
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.comments[0]._id).toBe(reply._id);

    await request(app)
      .delete(`/reddit/comments/${reply._id}/save`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);

    res = await request(app)
      .delete(`/reddit/comments/${reply._id}/save`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);
    expect(res.body.alreadyUnsaved).toBe(true);

    await request(app)
      .delete(`/reddit/comments/${comment._id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);

    res = await request(app)
      .get(`/reddit/posts/${post._id}/comments`)
      .expect(200);
    const deleted = res.body.comments.find(item => item._id === comment._id);
    expect(deleted.body).toBe('[deleted]');
  });

  test('rejects replies beyond the maximum nesting depth', async () => {
    const owner = await registerUser('depthowner');
    const member = await registerUser('depthmember');
    const community = await createCommunity(owner.token);
    const post = await createPost(owner.token, community.name);
    await joinCommunity(member.token, community.name);

    let parent = await createComment(member.token, post._id, 'Depth 0');
    for (let depth = 1; depth <= 7; depth += 1) {
      parent = await createReply(member.token, parent._id, `Depth ${depth}`);
      expect(parent.depth).toBe(depth);
    }

    await request(app)
      .post(`/reddit/comments/${parent._id}/reply`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ body: 'Too deep' })
      .expect(400);
  });
});

describe('search', () => {
  test('searches active users by username without exposing private fields', async () => {
    const active = await registerUser('searchactive');
    const hidden = await registerUser('searchhidden');
    await User.updateOne({ _id: hidden.id }, { $set: { isActive: false } });

    let res = await request(app)
      .get(`/reddit/search/users?q=${active.username}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.users[0]).toMatchObject({ _id: active.id, username: active.username });
    expect(res.body.users[0]).not.toHaveProperty('email');
    expect(res.body.users[0]).not.toHaveProperty('password');

    res = await request(app)
      .get(`/reddit/search/users?q=${hidden.username}`)
      .expect(200);
    expect(res.body.total).toBe(0);

    await request(app)
      .get('/reddit/search/users')
      .expect(400);

    await request(app)
      .get(`/reddit/search/users?q=${'a'.repeat(51)}`)
      .expect(400);
  });

  test('searches communities while respecting private community visibility and pagination', async () => {
    const owner = await registerUser('searchowner');
    const outsider = await registerUser('searchoutsider');
    const tag = nextCommunityName('topic').slice(0, 8);

    const publicCommunity = await createCommunity(owner.token, {
      name: `${tag}public`,
      description: 'Public description',
    });
    const restrictedCommunity = await createCommunity(owner.token, {
      name: `${tag}restricted`,
      type: 'restricted',
      description: 'Restricted description',
    });
    const privateCommunity = await createCommunity(owner.token, {
      name: `${tag}private`,
      type: 'private',
      description: 'Private description',
    });
    await createCommunity(owner.token, {
      name: nextCommunityName('cookbook'),
      description: `${tag} appears in this description`,
    });

    let res = await request(app)
      .get(`/reddit/search/communities?q=${tag}`)
      .expect(200);
    expect(res.body.communities.map(item => item.name)).toEqual(
      expect.arrayContaining([publicCommunity.name, restrictedCommunity.name]),
    );
    expect(res.body.communities.map(item => item.name)).not.toContain(privateCommunity.name);

    res = await request(app)
      .get(`/reddit/search/communities?q=${tag}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(200);
    expect(res.body.communities.map(item => item.name)).not.toContain(privateCommunity.name);

    res = await request(app)
      .get(`/reddit/search/communities?q=${tag}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(res.body.communities.map(item => item.name)).toContain(privateCommunity.name);

    res = await request(app)
      .get(`/reddit/search/communities?q=${tag}&limit=1&page=1`)
      .expect(200);
    expect(res.body.communities).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.totalPages).toBeGreaterThanOrEqual(3);

    await request(app)
      .get('/reddit/search/communities')
      .expect(400);

    await request(app)
      .get(`/reddit/search/communities?q=${'a'.repeat(51)}`)
      .expect(400);
  });
});
