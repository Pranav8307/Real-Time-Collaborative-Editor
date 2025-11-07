import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupStaticMiddleware(app) {
    // Serve static files from the React app
    const clientBuildPath = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientBuildPath));

    // Handle React routing: return all non-API/WS GET requests to the React app
    // Use a middleware (app.use) rather than an express route pattern to avoid compatibility
    // issues with different path-to-regexp versions in various environments.
    app.use((req, res, next) => {
        // Only handle browser navigation GET/HEAD requests
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();

        // Skip API and WebSocket paths
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next();

        // If the request matches a static file that exists, let express.static serve it
        // Otherwise, always send index.html so the client router can handle the path.
        const indexFile = path.join(clientBuildPath, 'index.html');
        res.sendFile(indexFile, (err) => {
            if (err) return next(err);
        });
    });
}