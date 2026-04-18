const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./Config/database');
const authRoutes = require('./Routes/authRoute');
const userRoutes = require('./Routes/userRoute');
const adminRoutes = require('./Routes/adminRoute');
const communityRoutes = require('./Routes/communityRoute');
const { protect } = require('./Middlewares/authMiddleware');
const dotenv = require('dotenv');
const path = require('path');

// .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Connect to MongoDB
connectDB();

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limit auth routes — 20 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later' },
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ success: true, message: 'API is running' }));
app.use('/reddit/auth', authLimiter, authRoutes);
app.use('/reddit/users', protect, userRoutes);
app.use('/reddit/admin', adminRoutes);
app.use('/reddit/communities', communityRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
