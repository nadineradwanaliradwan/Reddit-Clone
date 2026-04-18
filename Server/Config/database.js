const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    await mongoose.connect(uri, { dbName: 'Reddit_Clone_Database' });

    console.log('MongoDB connected');
  } catch (error) {
    console.error('Reddit_Clone_Database connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;