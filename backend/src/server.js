require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const workplaceRoutes = require('./routes/workplaceRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const faceRoutes = require('./routes/faceRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/geofence_attendance';

// Middleware
app.use(cors({
  origin: '*', // Allows local React frontend and mobile requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'geofence-attendance-backend',
    database: dbStatus,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/workplaces', workplaceRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/face', faceRoutes);

// Centralized 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Exception]:', err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

/**
 * Connect to MongoDB with robust fallback
 */
async function connectDatabase() {
  const rawTimeout = Number(process.env.MONGODB_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? Math.floor(rawTimeout) : 10000;

  const connectOptions = {
    serverSelectionTimeoutMS: timeoutMs
  };

  // Ensure Mongoose connects to the intended database (geofence_attendance)
  // if not already specified in the URI path or through MONGODB_DB_NAME
  const uriDbMatch = MONGODB_URI.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
  if (process.env.MONGODB_DB_NAME) {
    connectOptions.dbName = process.env.MONGODB_DB_NAME;
  } else if (!uriDbMatch || !uriDbMatch[1]) {
    connectOptions.dbName = 'geofence_attendance';
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, connectOptions);
    console.log('MongoDB successfully connected.');
  } catch (err) {
    console.error(`Local/Remote MongoDB connection failed: ${err.message}`);

    // In production, do not start accepting attendance requests with silent fallback storage
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRITICAL] Production database connection failed. Server startup aborted to prevent unpersisted/fallback attendance data.');
      throw err;
    }

    console.log('Attempting in-memory MongoDB fallback for local development/testing...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      console.log(`In-memory MongoDB started at: ${memoryUri}`);
      await mongoose.connect(memoryUri, { dbName: connectOptions.dbName });
      console.log('Connected to In-Memory MongoDB successfully.');
    } catch (memErr) {
      console.error('In-memory MongoDB fallback also failed or package not installed:', memErr.message);
      console.error('Please ensure MongoDB is running or configure MONGODB_URI in backend/.env');
    }
  }
}

// Start server function
async function startServer() {
  try {
    await connectDatabase();
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL] Failed to start server in production due to database connection error.');
      process.exit(1);
    }
  }
  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Geofence Attendance Backend running on port ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  API Base URL: http://localhost:${PORT}/api`);
    console.log(`====================================================`);
  });
  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };
