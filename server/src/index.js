import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectDB } from './config/database.js';
import { WebSocketHub } from './services/websocket.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import healthRoutes from './routes/health.js';
import logger from './utils/logger.js';
import yjsPersistence from './services/yjs-persistence.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info({ method: req.method, path: req.path }, 'Incoming request');
  next();
});

// Import static middleware
import { setupStaticMiddleware } from './static-middleware.js';

// If running in production, serve client static files before API routes so the
// client app is served at the root path.
if (process.env.NODE_ENV === 'production') {
  setupStaticMiddleware(app);
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api', healthRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error({ error: err, path: req.path }, 'Unhandled error');
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Nimbus Collaborative Editor API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      documents: '/api/documents',
      metrics: '/api/metrics',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Initialize WebSocket hub
const wsHub = new WebSocketHub(server);

// Startup
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await connectDB();
    
    // Start cleanup interval for old operations
    setInterval(() => {
      yjsPersistence.cleanupOldOperations();
    }, 24 * 60 * 60 * 1000); // Daily
    
    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'Server started');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

start();

