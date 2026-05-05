# Running the Reddit Clone

Both the **Server** (Express) and **Client** (Vite + React) need to be running for the app to work end-to-end.

## One-time setup

Open **two** terminals (PowerShell, Git Bash, or Windows Terminal — anything except `cmd` is easiest).

### Terminal 1 — Server

```bash
cd "D:\ASU\Semester 8\IP\Project\Reddit-Clone\Server"
npm install
npm run dev
```

The server starts on `http://localhost:5000`. You should see `Server is running on port 5000`. Visiting `http://localhost:5000/` in a browser returns `{ "success": true, "message": "API is running" }`.

> The `Server/.env` is already filled in (MongoDB Atlas, JWT secrets, Gemini API key, `CLIENT_URL=http://localhost:5173`). You don't need to do anything else.

### Terminal 2 — Client

```bash
cd "D:\ASU\Semester 8\IP\Project\Reddit-Clone\Client"
npm install
npm run dev
```

The Vite dev server starts on `http://localhost:5173`. Open that URL in your browser.

## Day-to-day

After the first install, you only need:

```bash
# Server
cd Server && npm run dev

# Client (in a second terminal)
cd Client && npm run dev
```

## Sanity-check the integration

Once both servers are running:

1. Go to `http://localhost:5173/register` and create an account.
2. After registering you should land on `/` with the navbar showing your username.
3. Go to `/communities` and create a community (e.g. `r/test`).
4. Click your community → click `+` in the navbar → submit a text post.
5. Open the post, write a comment, upvote it, click "Summarize Discussion with AI".
6. Open `/settings` → change your username and click Save profile.
7. **Realtime chat:** open another browser (or incognito) and register a second user. From either side, go to the other's profile (`/u/<username>`) and click **Message** — or click the chat icon in the navbar and use **New** to find the user. Type a message; it should appear instantly on the other side. Stop typing for ≥1.5 s and the typing indicator clears. Refreshing either window keeps the history.

If any step fails, open the browser DevTools → Network tab. The frontend hits `http://localhost:5000/reddit/...`. A red 4xx/5xx response there is the issue, not the UI.

## Common issues

- **CORS errors in the browser console** — make sure the server is actually running on port 5000. The server already has `cors()` enabled wide-open for development.
- **`401 Unauthorized` on every request** — the access token in `localStorage` is expired (default lifetime is 15 minutes, see `JWT_EXPIRES_IN` in `Server/.env`). Just log out and log back in, or bump `JWT_EXPIRES_IN=24h` for development.
- **`POST /reddit/posts/:id/summarize` returns 503** — `GEMINI_API_KEY` isn't set on the server. It already is in `.env`, but if you cleared it, get a free key from `https://aistudio.google.com/app/apikey`.
- **MongoDB timeout** — your IP might not be allowlisted on the Atlas cluster. In Atlas → Network Access, add your current IP (or `0.0.0.0/0` for development).

## Tech stack reference

| Area | Stack |
|------|-------|
| Backend | Node 18+, Express 5, Mongoose 9, JWT, Socket.IO, Google Gemini |
| Frontend | React 18, TypeScript, Vite, React Router 7, TanStack Query, Tailwind, shadcn/ui (Radix), react-hook-form + zod |
| Database | MongoDB Atlas (already wired up in `Server/.env`) |

## Project structure

```
Reddit-Clone/
├── Server/                 # Express API on port 5000
│   ├── index.js            # Entry, route mounting, CORS
│   ├── Routes/             # Per-resource Express routers
│   ├── Controllers/        # Business logic
│   ├── Models/             # Mongoose schemas
│   ├── Middlewares/        # protect (JWT), optionalProtect
│   ├── Services/aiService.js  # Gemini wrapper
│   ├── Sockets/chatSocket.js  # Real-time chat (bonus feature)
│   └── .env                # Fully configured already
└── Client/                 # Vite SPA on port 5173
    └── src/
        ├── api/            # client.ts (fetch wrapper), reddit-service.ts
        ├── pages/          # Route components (Home, Login, Settings, …)
        ├── components/     # PostCard, VoteControl, CommentSection, Summarizer, …
        ├── hooks/          # use-reddit-query.ts (TanStack Query bindings)
        ├── context/        # auth-context, theme-context
        └── router/         # React Router config
```
