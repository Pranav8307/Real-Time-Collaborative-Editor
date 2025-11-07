import express from 'express';
import { connectDB } from '../config/database.js';
import { register } from '../utils/metrics.js';
import mongoose from 'mongoose';

const router = express.Router();

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Nimbus Collaborative Editor API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      metrics: '/api/metrics',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
      },
      documents: {
        list: 'GET /api/documents',
        get: 'GET /api/documents/:id',
        create: 'POST /api/documents',
        update: 'PATCH /api/documents/:id',
        delete: 'DELETE /api/documents/:id',
        share: 'POST /api/documents/:id/share',
      },
    },
  });
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
    });
  }
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

export default router;

