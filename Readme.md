# Reddit Clone

A full-stack web application mirroring Reddit's core functionality. Currently the **Server** (Node/Express backend) is complete. A frontend (React/Vite) is planned.

---

## Features Implemented

### Authentication (`/reddit/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Create account, returns access + refresh tokens | Public |
| POST | `/login` | Sign in, returns tokens. Brute-force protected | Public |
| POST | `/refresh` | Exchange refresh token for new token pair | Public |
| POST | `/logout` | Invalidate session (clears refresh token) | Required |
| GET | `/me` | Get current user's profile | Required |
| POST | `/forgot-password` | Send password reset email via Resend | Public |
| PATCH | `/reset-password/:token` | Set new password using reset token (10 min expiry) | Public |

### User (`/reddit/users`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| PATCH | `/me` | Update username or email | Required |
| PATCH | `/me/password` | Change password (requires current password) | Required |

### Admin (`/reddit/admin`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users` | Paginated list of all users | Admin only |
| PATCH | `/users/:id/status` | Ban / unban a user | Admin only |

### Communities (`/reddit/communities`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/:name` | Get community details | Public (private communities: members only) |
| POST | `/` | Create a new community | Required |
| POST | `/:name/join` | Join a community | Required |
| POST | `/:name/leave` | Leave a community | Required |
| POST | `/:name/flairs` | Add a flair to the community | Moderator only |
| PATCH | `/:name/flairs/:flairId` | Rename / recolor a flair | Moderator only |
| DELETE | `/:name/flairs/:flairId` | Remove a flair (posts using it are unflaired) | Moderator only |

**Flair fields**
- `name` — required, up to 64 chars, must be unique within the community (case-insensitive)
- `textColor` — optional, hex (`#ffffff`, `#fff`, or `#ffffffff`); defaults to `#ffffff`
- `backgroundColor` — optional, hex; defaults to `#0079d3`

Communities can have at most 100 flairs. Deleting a flair also clears `flair: null` on every post that referenced it, so no post ends up pointing at a flair that no longer exists.

### Posts (`/reddit/posts`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create a post (text, link, or image) in a community | Required — must be a member |
| GET | `/feed` | Cross-community feed: `home`, `popular`, or `saved` (see below) | `popular` is public; `home` / `saved` require auth |
| GET | `/community/:name` | List posts in a community (paginated + filterable) | Public (private communities: members only) |
| GET | `/:id` | Get a single post by id | Public (private communities: members only) |
| PATCH | `/:id` | Edit post content (title, type-specific field, flair) | Author only |
| DELETE | `/:id` | Soft-delete a post | Author only |
| POST | `/:id/save` | Save a post to the user's saved feed (idempotent) | Required |
| DELETE | `/:id/save` | Remove a post from the user's saved feed (idempotent) | Required |
| POST | `/:id/summarize` | AI-generated 2-3 sentence summary of the post (cached) | Required (rate-limited 10/hour) |

**Post types & required fields**
- `text` — `title`, `body` (max 40,000 chars)
- `link` — `title`, `url` (http/https)
- `image` — `title`, `imageUrl` (http/https; upload handling is out of scope — supply a hosted URL)

Create and update requests may also include an optional `flair` — the `_id` of a flair defined on the target community (or `null` / `""` on update to clear it). Create requests send `community` (the community name). The endpoint enforces `community.isArchived`, membership, and the community's `allowedPostTypes` setting. Deleted posts still respond 200 on GET but return redacted content (title becomes `[deleted]`, body/url/imageUrl are empty) and are excluded from list queries.

**Query params on `GET /community/:name`**

| Param | Values | Default | Notes |
|-------|--------|---------|-------|
| `page` | integer ≥ 1 | `1` | 1-indexed page number |
| `limit` | integer 1–50 | `20` | Page size, capped at 50 |
| `sort` | `new` \| `old` | `new` | Newest-first or oldest-first |
| `type` | `text` \| `link` \| `image` | — | Filter by post type |
| `flair` | `<flairId>` \| `none` | — | Specific flair id, or `none` for unflaired posts only |
| `t` | `hour` \| `day` \| `week` \| `month` \| `year` \| `all` | `all` | Only posts created within the window |

Invalid filter values return `400` rather than being silently ignored. The response echoes back the active filters (`sort`, `typeFilter`, `flairFilter`, `timeFilter`) and includes the community's `flairs` array so clients can render a flair-filter UI.

**Feed page — `GET /feed`**

A single endpoint serves three feed scopes via the `?scope=` query param:

| Scope | Source of posts | Auth |
|-------|------------------|------|
| `popular` *(default)* | Every **public** community | Public |
| `home` | Communities the logged-in user has joined | Required |
| `saved` | Posts the logged-in user has saved (sorted by save time) | Required |

The same query params from the community feed are accepted (`page`, `limit`, `sort`, `type`, `flair`, `t`) with identical validation rules. A `flair` id is community-scoped, so passing one effectively narrows the feed to a single community — useful but unusual; pass `flair=none` to show only unflaired posts. Anonymous requests to `home` or `saved` get `401`. The response shape matches `/community/:name` minus the `community` block, plus a `scope` field echoing back the chosen scope.

**Save / unsave — `POST` and `DELETE /:id/save`**

Both endpoints are **idempotent**: re-saving an already-saved post returns `200` with `alreadySaved: true`, and unsaving a non-saved post returns `200` with `alreadyUnsaved: true`. A unique compound index on `(user, post)` prevents duplicate save records at the database level.

**AI summarization — `POST /:id/summarize`**

Generates (or returns the cached) 2-3 sentence summary of a post via Google Gemini (free tier). Results are cached on the post document, keyed by a SHA-256 hash of the prompt-relevant fields (`type + title + body/url/imageUrl`); the next request returns the cached summary instantly without burning API quota. Editing the post body/title/url/imageUrl invalidates the hash and triggers a regenerate on the next call. Editing unrelated fields (e.g. flair) does not invalidate the cache.

Per-user rate limit: **10 requests per hour**, applied even on cache hits (gates abuse independently of API consumption). Standard `RateLimit-*` response headers are included so clients can self-throttle.

Response:
```json
{ "success": true, "summary": "...", "generatedAt": "...", "cached": true|false }
```

Error mapping:
- `503` — `GEMINI_API_KEY` is not configured on the server
- `502` — Gemini API returned an error
- `504` — Gemini request timed out (>15s)
- `429` — rate limit exceeded

---

## Security Features

- **JWT auth** — short-lived access tokens (15h) + long-lived refresh tokens (7d) with rotation
- **Token invalidation** — password change immediately invalidates all existing tokens
- **Brute-force protection** — account locks for 30 min after 5 failed login attempts
- **No user enumeration** — login and forgot-password return identical responses regardless of whether an account exists
- **Hashed storage** — refresh tokens and password-reset tokens stored as SHA-256 hashes in MongoDB
- **Sensitive field protection** — `select: false` on all sensitive schema fields; `toJSON()` strips them from every response
- **Input validation** — `express-validator` on all endpoints
- **Security headers** — `helmet`, CORS restricted to `CLIENT_URL`
- **Rate limiting** — auth routes: 20 requests per 15 minutes

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Resend account (for password reset emails)

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/Reddit-Clone.git
cd Reddit-Clone
```

### 2. Install dependencies
```bash
cd Server
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```

Fill in the values in `.env`:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `PORT` | Server port (default `5000`) |
| `JWT_SECRET` | Access token signing key — generate with command below |
| `JWT_REFRESH_SECRET` | Refresh token signing key — must differ from `JWT_SECRET` |
| `JWT_EXPIRES_IN` | Access token TTL (e.g. `15h`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g. `7d`) |
| `RESEND_API_KEY` | API key from resend.com |
| `EMAIL_FROM_NAME` | Sender display name (e.g. `Reddit Clone`) |
| `EMAIL_FROM_ADDRESS` | Sender email — use `onboarding@resend.dev` for testing |
| `CLIENT_URL` | Frontend origin (e.g. `http://localhost:5173`) |
| `GEMINI_API_KEY` | Google AI Studio API key (free tier). Get one at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey). Optional — if omitted, only `/posts/:id/summarize` returns 503 and the rest of the API works normally. |

Generate JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run twice — use each output for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

### 4. Run the server
```bash
# Development (hot-reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:5000`. Confirm it's running:
```
GET http://localhost:5000/
→ { "success": true, "message": "API is running" }
```

---

## Project Structure

```
Reddit-Clone/
└── Server/
    ├── index.js                    # Entry point: middleware, routes, error handlers
    ├── .env.example                # Environment variable template
    ├── Config/
    │   ├── database.js             # Mongoose connection
    │   └── email.js                # Resend email helper
    ├── Models/
    │   ├── authModel.js            # User schema
    │   ├── communityModel.js       # Community schema (rules, flairs, types)
    │   ├── membershipModel.js      # User ↔ Community join table
    │   ├── postModel.js            # Post schema (text | link | image), soft delete
    │   └── savedPostModel.js       # User ↔ Post join table for the saved feed
    ├── Controllers/
    │   ├── authController.js       # register, login, refresh, logout, me, forgot/reset password
    │   ├── userController.js       # updateProfile, changePassword
    │   ├── adminController.js      # getAllUsers, toggleUserStatus
    │   ├── communityController.js  # createCommunity, getCommunity, join, leave, flair CRUD
    │   └── postController.js       # createPost, getPost, listPostsByCommunity, updatePost, deletePost, listFeed, savePost, unsavePost
    ├── Routes/
    │   ├── authRoute.js
    │   ├── userRoute.js
    │   ├── adminRoute.js
    │   ├── communityRoute.js
    │   └── postRoute.js
    ├── Middlewares/
    │   ├── authMiddleware.js        # protect (JWT verify) + restrictTo (RBAC)
    │   └── optionalProtect.js      # Like protect but never blocks — sets req.user or null
    └── Services/
        └── aiService.js            # Google Gemini wrapper for post summarization
```

---

## Architecture Notes

### Token flow
- **Access token** — short-lived JWT signed with `JWT_SECRET`, carries `{ id, role }`. Sent in `Authorization: Bearer <token>` header.
- **Refresh token** — long-lived JWT signed with `JWT_REFRESH_SECRET`. SHA-256 hash stored in DB, raw token sent to client only. Rotated on every `/refresh` call.

### Community access levels
| Type | View | Post |
|------|------|------|
| `public` | Anyone | Members only |
| `restricted` | Anyone | Members only |
| `private` | Members only | Members only |

### Response shape
All responses follow `{ success: boolean, message?: string, ...data }`.
Validation errors return `{ success: false, errors: [...] }`.

### Middleware order
`helmet` → `cors` → `express.json` → rate limiter (auth only) → routes
