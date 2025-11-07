# Nimbus - Real-Time Collaborative Editor

A production-ready real-time collaborative text editor built with Node.js, React, Yjs (CRDT), WebSockets, and MongoDB.

## Features

- **Real-Time Collaboration**: Multiple users can edit the same document simultaneously with conflict-free merging
- **CRDT-Based**: Uses Yjs for guaranteed convergence and intention preservation
- **Shared Cursors & Selections**: See other users' cursors and selections in real-time
- **Offline Support**: Queue operations while offline, sync on reconnect
- **Low Latency**: Optimistic UI updates with server reconciliation
- **Persistence**: MongoDB storage with snapshots and operation logs
- **Access Control**: JWT authentication with role-based permissions (owner/editor/viewer)
- **Observability**: Structured logging, Prometheus metrics, health endpoints
- **Scalable**: Room-based architecture ready for horizontal scaling

## Architecture

### Server
- **Express.js** REST API for authentication and document management
- **WebSocket** hub for real-time collaboration
- **Yjs** CRDT engine for conflict resolution
- **MongoDB** for persistence (snapshots + operation logs)
- **JWT** for authentication
- **Prometheus** metrics and structured logging

### Client
- **React** with Vite for fast development
- **CodeMirror 6** for the editor interface
- **Yjs** for local CRDT state
- **IndexedDB** for offline persistence
- **WebSocket** for real-time sync

## Prerequisites

- Node.js 18+ 
- MongoDB 5.0+
- npm or yarn

## Installation

1. Clone the repository:
```bash
cd nimbus-collab
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Install client dependencies:
```bash
cd ../client
npm install
```

4. Set up environment variables:
```bash
cd ../server
cp .env.example .env
```

Edit `.env` with your configuration:
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/nimbus-collab
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
LOG_LEVEL=info
```

5. Start MongoDB (if not running):
```bash
# On macOS/Linux
mongod

# On Windows (if installed as service, it should be running)
```

## Running the Application

### Development Mode

1. Start the server:
```bash
cd server
npm run dev
```

2. Start the client (in a new terminal):
```bash
cd client
npm run dev
```

3. Open your browser to `http://localhost:3000`

### Production Mode

1. Build the client:
```bash
cd client
npm run build
```

2. Start the server:
```bash
cd server
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Documents
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document metadata
- `POST /api/documents` - Create document
- `PATCH /api/documents/:id` - Update document (title, ACL)
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/share` - Share document with user

### Health & Metrics
- `GET /api/health` - Health check
- `GET /api/metrics` - Prometheus metrics

## WebSocket Protocol

The WebSocket endpoint is at `/ws`. Messages use a binary protocol:

- **Message Type 0**: Sync (Yjs protocol)
- **Message Type 1**: Awareness (cursors/selections)
- **Message Type 2**: Authentication

## Testing

### Multi-Client Test

Open multiple browser tabs/windows and navigate to the same document to test real-time collaboration.

### Snapshot Integrity

The server automatically creates snapshots every 100 operations and cleans up old operations after 30 days.

## Project Structure

```
nimbus-collab/
├── server/
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── models/          # Mongoose models
│   │   ├── routes/          # Express routes
│   │   ├── services/        # Yjs persistence, WebSocket hub
│   │   ├── middleware/      # Auth middleware
│   │   ├── utils/           # Logger, metrics
│   │   └── index.js         # Server entry point
│   ├── .env.example
│   └── package.json
│
└── client/
    ├── src/
    │   ├── components/      # React components
    │   ├── services/        # API client, Yjs provider
    │   ├── store/           # Zustand stores
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    └── package.json
```

## Configuration

### Server Environment Variables

- `PORT` - Server port (default: 3001)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT tokens
- `JWT_EXPIRES_IN` - Token expiration (default: 7d)
- `LOG_LEVEL` - Logging level (default: info)
- `NODE_ENV` - Environment (development/production)

### MongoDB Collections

- `users` - User accounts
- `documents` - Document metadata and snapshots
- `documentsnapshots` - Periodic snapshots
- `operationlogs` - Operation history

## Performance Considerations

- **Snapshot Interval**: Configurable (default: every 100 operations)
- **Operation Retention**: 30 days (configurable)
- **Connection Limits**: WebSocket connections are tracked per document
- **Backpressure**: WebSocket messages are queued and throttled

## Security

- JWT tokens for authentication
- Password hashing with bcrypt
- Role-based access control (owner/editor/viewer)
- Input validation on server-side
- CORS configuration

## Monitoring

- Prometheus metrics at `/api/metrics`
- Structured JSON logging with correlation IDs
- Health check endpoint at `/api/health`
- Connection and operation metrics

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify network connectivity

### WebSocket Connection Issues
- Check server logs for errors
- Verify WebSocket path is `/ws`
- Check firewall/proxy settings

### Document Not Syncing
- Check browser console for errors
- Verify user has access to document
- Check server logs for operation errors

## License

ISC

## Contributing

This is a complete implementation for the Nimbus collaborative editor project. All features from the problem statement have been implemented.

