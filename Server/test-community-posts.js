/**
 * Manual integration test for GET /reddit/posts/community/:name
 * Run with:  node test-community-posts.js
 * Requires the server to be running on http://localhost:5000
 */

const BASE = 'http://localhost:5000/reddit';
const TAG  = `test${Date.now()}`;  // unique suffix so repeated runs don't collide

// ─── Helpers ──────────────────────────────────────────────────────────────────

const post = (path, body, token) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  }).then(r => r.json());

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => r.json());

let passed = 0;
let failed = 0;

const assert = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
};

// ─── Test data ────────────────────────────────────────────────────────────────

const COMMUNITY = `community${TAG}`;
const USER1 = { username: `alice${TAG}`, email: `alice${TAG}@test.com`, password: 'Test1234!' };
const USER2 = { username: `bob${TAG}`,   email: `bob${TAG}@test.com`,   password: 'Test1234!' };

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n=== Community Posts Test (tag: ${TAG}) ===\n`);

  // ── 1. Register & login ────────────────────────────────────────────────────
  console.log('1. Auth setup');

  const reg1 = await post('/auth/register', USER1);
  assert('user1 registered', reg1.success, JSON.stringify(reg1));

  const reg2 = await post('/auth/register', USER2);
  assert('user2 registered', reg2.success, JSON.stringify(reg2));

  const login1 = await post('/auth/login', { email: USER1.email, password: USER1.password });
  assert('user1 logged in', login1.success, JSON.stringify(login1));
  const token1 = login1.accessToken;

  const login2 = await post('/auth/login', { email: USER2.email, password: USER2.password });
  assert('user2 logged in', login2.success, JSON.stringify(login2));
  const token2 = login2.accessToken;

  // ── 2. Create community ────────────────────────────────────────────────────
  console.log('\n2. Community setup');

  const comm = await post('/communities', {
    name: COMMUNITY,
    description: 'Test community for post listing',
    type: 'public',
    allowedPostTypes: 'any',
  }, token1);
  assert('community created', comm.success, JSON.stringify(comm));

  // ── 3. Create posts ────────────────────────────────────────────────────────
  console.log('\n3. Creating posts');

  const p1 = await post('/posts', { community: COMMUNITY, type: 'text',  title: 'Text post 1',  body: 'Hello world' }, token1);
  assert('text post 1 created', p1.success, JSON.stringify(p1));

  const p2 = await post('/posts', { community: COMMUNITY, type: 'text',  title: 'Text post 2',  body: 'Another text' }, token1);
  assert('text post 2 created', p2.success, JSON.stringify(p2));

  const p3 = await post('/posts', { community: COMMUNITY, type: 'link',  title: 'Link post',    url: 'https://example.com' }, token1);
  assert('link post created', p3.success, JSON.stringify(p3));

  const p4 = await post('/posts', { community: COMMUNITY, type: 'image', title: 'Image post',   imageUrl: 'https://example.com/img.png' }, token1);
  assert('image post created', p4.success, JSON.stringify(p4));

  // ── 4. Default listing (sort=new, all types) ───────────────────────────────
  console.log('\n4. Default listing (sort=new, authenticated member)');

  const defaultRes = await get(`/posts/community/${COMMUNITY}`, token1);
  assert('request succeeded',           defaultRes.success);
  assert('returns 4 posts',             defaultRes.total === 4,         `got ${defaultRes.total}`);
  assert('community info included',     !!defaultRes.community);
  assert('community name correct',      defaultRes.community?.name === COMMUNITY);
  assert('community description',       !!defaultRes.community?.description);
  assert('community memberCount',       typeof defaultRes.community?.memberCount === 'number');
  assert('isMember true for member',    defaultRes.isMember === true);
  assert('memberRole is moderator',     defaultRes.memberRole === 'moderator');
  assert('sort echoed as "new"',        defaultRes.sort === 'new');
  assert('typeFilter is null',          defaultRes.typeFilter === null);
  assert('posts is array',              Array.isArray(defaultRes.posts));
  assert('newest post is first',        defaultRes.posts[0]?.title === 'Image post',  `first title: ${defaultRes.posts[0]?.title}`);

  // ── 5. sort=old ────────────────────────────────────────────────────────────
  console.log('\n5. sort=old');

  const oldRes = await get(`/posts/community/${COMMUNITY}?sort=old`, token1);
  assert('request succeeded',           oldRes.success);
  assert('sort echoed as "old"',        oldRes.sort === 'old');
  assert('oldest post is first',        oldRes.posts[0]?.title === 'Text post 1',  `first title: ${oldRes.posts[0]?.title}`);

  // ── 6. type=text filter ────────────────────────────────────────────────────
  console.log('\n6. type=text filter');

  const textRes = await get(`/posts/community/${COMMUNITY}?type=text`, token1);
  assert('request succeeded',           textRes.success);
  assert('returns 2 text posts',        textRes.total === 2,             `got ${textRes.total}`);
  assert('typeFilter echoed as "text"', textRes.typeFilter === 'text');
  assert('all posts are text type',     textRes.posts.every(p => p.type === 'text'));

  // ── 7. type=link filter ────────────────────────────────────────────────────
  console.log('\n7. type=link filter');

  const linkRes = await get(`/posts/community/${COMMUNITY}?type=link`, token1);
  assert('request succeeded',           linkRes.success);
  assert('returns 1 link post',         linkRes.total === 1,             `got ${linkRes.total}`);
  assert('post has url',                !!linkRes.posts[0]?.url);

  // ── 8. type=image filter ───────────────────────────────────────────────────
  console.log('\n8. type=image filter');

  const imageRes = await get(`/posts/community/${COMMUNITY}?type=image`, token1);
  assert('request succeeded',           imageRes.success);
  assert('returns 1 image post',        imageRes.total === 1,            `got ${imageRes.total}`);
  assert('post has imageUrl',           !!imageRes.posts[0]?.imageUrl);

  // ── 9. Pagination ──────────────────────────────────────────────────────────
  console.log('\n9. Pagination');

  const page1 = await get(`/posts/community/${COMMUNITY}?limit=2&page=1`, token1);
  assert('page 1: 2 posts returned',    page1.posts?.length === 2,       `got ${page1.posts?.length}`);
  assert('totalPages is 2',             page1.totalPages === 2,          `got ${page1.totalPages}`);
  assert('page echoed as 1',            page1.page === 1);

  const page2 = await get(`/posts/community/${COMMUNITY}?limit=2&page=2`, token1);
  assert('page 2: 2 posts returned',    page2.posts?.length === 2,       `got ${page2.posts?.length}`);
  assert('page echoed as 2',            page2.page === 2);

  // ── 10. Unauthenticated request ────────────────────────────────────────────
  console.log('\n10. Unauthenticated request (public community)');

  const anonRes = await get(`/posts/community/${COMMUNITY}`);
  assert('request succeeded',           anonRes.success);
  assert('isMember is false',           anonRes.isMember === false);
  assert('memberRole is null',          anonRes.memberRole === null);
  assert('community info still returned', !!anonRes.community);

  // ── 11. Non-member authenticated user ─────────────────────────────────────
  console.log('\n11. Non-member authenticated user');

  const nonMemberRes = await get(`/posts/community/${COMMUNITY}`, token2);
  assert('request succeeded',           nonMemberRes.success);
  assert('isMember is false',           nonMemberRes.isMember === false);
  assert('memberRole is null',          nonMemberRes.memberRole === null);
  assert('can still see posts',         nonMemberRes.total === 4);

  // ── 12. invalid sort falls back to "new" ──────────────────────────────────
  console.log('\n12. Invalid sort falls back to "new"');

  const badSort = await get(`/posts/community/${COMMUNITY}?sort=hot`);
  assert('request succeeded',           badSort.success);
  assert('sort defaults to "new"',      badSort.sort === 'new');

  // ── 13. Invalid type filter is ignored ────────────────────────────────────
  console.log('\n13. Invalid type filter is ignored');

  const badType = await get(`/posts/community/${COMMUNITY}?type=video`);
  assert('request succeeded',           badType.success);
  assert('typeFilter is null',          badType.typeFilter === null);
  assert('all 4 posts returned',        badType.total === 4,             `got ${badType.total}`);

  // ── 14. Non-existent community ────────────────────────────────────────────
  console.log('\n14. Non-existent community → 404');

  const notFound = await get('/posts/community/doesnotexist99999');
  assert('returns 404 shape',           notFound.success === false);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
