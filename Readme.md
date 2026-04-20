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

### Posts (`/reddit/posts`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create a post (text, link, or image) in a community | Required — must be a member |
| GET | `/community/:name` | List posts in a community (paginated: `?page=&limit=`) | Public (private communities: members only) |
| GET | `/:id` | Get a single post by id | Public (private communities: members only) |
| PATCH | `/:id` | Edit post content (title + type-specific field) | Author only |
| DELETE | `/:id` | Soft-delete a post | Author only |

**Post types & required fields**
- `text` — `title`, `body` (max 40,000 chars)
- `link` — `title`, `url` (http/https)
- `image` — `title`, `imageUrl` (http/https; upload handling is out of scope — supply a hosted URL)

Create requests also send `community` (the community name). The endpoint enforces `community.isArchived`, membership, and the community's `allowedPostTypes` setting. Deleted posts still respond 200 on GET but return redacted content (title becomes `[deleted]`, body/url/imageUrl are empty) and are excluded from list queries.

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
    │   └── postModel.js            # Post schema (text | link | image), soft delete
    ├── Controllers/
    │   ├── authController.js       # register, login, refresh, logout, me, forgot/reset password
    │   ├── userController.js       # updateProfile, changePassword
    │   ├── adminController.js      # getAllUsers, toggleUserStatus
    │   ├── communityController.js  # createCommunity, getCommunity, join, leave
    │   └── postController.js       # createPost, getPost, listPostsByCommunity, updatePost, deletePost
    ├── Routes/
    │   ├── authRoute.js
    │   ├── userRoute.js
    │   ├── adminRoute.js
    │   ├── communityRoute.js
    │   └── postRoute.js
    └── Middlewares/
        ├── authMiddleware.js        # protect (JWT verify) + restrictTo (RBAC)
        └── optionalProtect.js      # Like protect but never blocks — sets req.user or null
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
