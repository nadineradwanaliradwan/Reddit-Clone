const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./Config/database');
const authRoutes = require('./Routes/authRoute');
const userRoutes = require('./Routes/userRoute');
const adminRoutes = require('./Routes/adminRoute');
const communityRoutes = require('./Routes/communityRoute');
const postRoutes = require('./Routes/postRoute');
const { postScopedRouter, commentRouter } = require('./Routes/commentRoute');
const notificationRoutes = require('./Routes/notificationRoute');
const searchRoutes = require('./Routes/searchRoute');
const chatRoutes = require('./Routes/chatRoute');
const chatSocket = require('./Sockets/chatSocket');
const { protect } = require('./Middlewares/authMiddleware');
const dotenv = require('dotenv');
const path = require('path');

// .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limit auth routes — 20 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many requests, please try again later' },
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ success: true, message: 'API is running' }));
app.use('/reddit/auth', authLimiter, authRoutes);
// Public profile/follow-list routes — must be mounted BEFORE the protected
// `userRoutes` mount, otherwise `protect` rejects the request before it can
// reach these GETs. See Routes/userRoute.js for the split.
app.use('/reddit/users', userRoutes.publicRouter);
app.use('/reddit/users', protect, userRoutes);
app.use('/reddit/admin', adminRoutes);
app.use('/reddit/communities', communityRoutes);
app.use('/reddit/search', searchRoutes);
app.use('/reddit/posts', postRoutes);
app.use('/reddit/posts/:postId/comments', postScopedRouter);
app.use('/reddit/comments', commentRouter);
app.use('/reddit/notifications', protect, notificationRoutes);
app.use('/reddit/chat', protect, chatRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
});
app.set('io', io);
chatSocket(io);

if (process.env.NODE_ENV !== 'test') {
  connectDB();
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

module.exports = app;