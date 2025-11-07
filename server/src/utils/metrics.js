import { Registry, Counter, Histogram, Gauge } from 'prom-client';

const register = new Registry();

// Operation metrics
export const opsCounter = new Counter({
  name: 'collab_ops_total',
  help: 'Total number of collaborative operations',
  labelNames: ['document_id', 'operation_type'],
  registers: [register],
});

export const opsLatency = new Histogram({
  name: 'collab_ops_latency_seconds',
  help: 'Latency of collaborative operations in seconds',
  labelNames: ['document_id', 'operation_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Connection metrics
export const activeConnections = new Gauge({
  name: 'collab_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['document_id'],
  registers: [register],
});

export const presenceCount = new Gauge({
  name: 'collab_presence_users',
  help: 'Number of users present in documents',
  labelNames: ['document_id'],
  registers: [register],
});

// Error metrics
export const errorCounter = new Counter({
  name: 'collab_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'document_id'],
  registers: [register],
});

// Request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export { register };

