# Reddit Clone Postman Collection

Import `Reddit-Clone-API.postman_collection.json` into Postman.

Run order:
1. Start the backend with `npm run dev` from `Server/`.
2. Run `00 Setup / Reset Generated Test Variables + Health Check`.
3. Run the collection folders in order.

Notes:
- The collection generates unique users, community names, posts, comments, flairs, and IDs on the setup request.
- Admin endpoints are included, but this API has no public endpoint to create an admin. Set `adminEmail`/`adminPassword` to an existing admin account, or paste an `adminToken` collection variable before running the admin requests.
- `POST /reddit/posts/:id/summarize` may return `503` unless `GEMINI_API_KEY` is configured. The collection test accepts the expected AI-service statuses.
- `forgot-password` and `reset-password` are not in the collection because their routes are currently commented out in `Server/Routes/authRoute.js`.
