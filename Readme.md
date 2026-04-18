## Project Overview

Reddit Clone — a full-stack web application mirroring Reddit's core functionality. Currently only the **Server** (Node/Express backend) exists. A frontend (likely React/Vite based on `CLIENT_URL=http://localhost:5173`) is planned.

## Commands

All commands run from `Server/`:

```bash
npm run dev      # Start with nodemon (hot-reload, development)
npm start        # Start with node (production)
```

No test runner is configured yet.

## Architecture

### Server structure

```
Server/
├── index.js              # Entry point: middleware stack, route mounting, error handlers
├── Config/
│   ├── database.js       # Mongoose connection (reads MONGO_URI, uses dbName: Reddit_Clone_Database)
│   └── email.js          # Nodemailer transporter + sendPasswordResetEmail helper
├── Models/
│   └── authModel.js      # Mongoose User schema — only model so far
├── Controllers/          # Route handlers (one file per domain)
├── Routes/               # Express routers with express-validator rules inline
└── Middlewares/
    └── authMiddleware.js # protect (JWT verify) + restrictTo (role RBAC)
```

### Auth flow

- **Access token**: short-lived JWT (default 15m), signed with `JWT_SECRET`, carries `{ id, role }`
- **Refresh token**: longer-lived JWT (default 7d), signed with `JWT_REFRESH_SECRET`. The **SHA-256 hash** of the raw token is stored in MongoDB — never the raw token. On refresh, the incoming token is hashed and compared.
- **Token invalidation**: `passwordChangedAt` is stored on the User; `protect` rejects any token issued before that timestamp (`changedPasswordAfter`).
- **Brute-force protection**: `loginAttempts` + `lockUntil` fields on User. Account locks for 30 min after 5 failed attempts.
- **Password reset**: 10-minute expiring token; hash stored in DB; reset also issues fresh access+refresh tokens.

### Response shape convention

All responses follow `{ success: boolean, message?: string, ...data }`. Validation errors return `{ success: false, errors: [...] }` (express-validator array).

### Route access levels

| Prefix | Guard |
|---|---|
| `GET /` | Public |
| `/api/auth/*` | Public (+ rate limit: 20 req / 15 min) |
| `/api/users/*` | `protect` (any authenticated user) |
| `/api/admin/*` | `protect` + `restrictTo('admin')` |

### Security middleware order (index.js)

`helmet` → `cors` → `express.json` → rate limiter (auth routes only) → routes

## Environment variables (.env)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `PORT` | Server port (default 5000) |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `JWT_EXPIRES_IN` | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g. `7d`) |
| `EMAIL_HOST/PORT/USER/PASS` | SMTP credentials (Gmail App Password) |
| `EMAIL_FROM_NAME` | Sender display name |
| `CLIENT_URL` | Frontend origin for reset-password links and CORS |

## Key conventions

- Sensitive fields (`password`, `refreshToken`, `passwordChangedAt`, `loginAttempts`, `lockUntil`, `passwordResetToken`) are `select: false` on the schema — explicitly `.select('+field')` when needed.
- `toJSON()` on User strips all sensitive fields automatically before any response serialization.
- User enumeration is prevented in login, forgot-password, and any lookup that could leak whether an account exists.
- `bcryptjs` with 12 salt rounds (not the default 10).
