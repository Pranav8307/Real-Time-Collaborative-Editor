# Quick Start Guide

## Prerequisites
- Node.js 18+
- MongoDB running locally or accessible

## Setup Steps

1. **Install MongoDB** (if not already installed)
   - Download from https://www.mongodb.com/try/download/community
   - Or use Docker: `docker run -d -p 27017:27017 mongo`

2. **Configure Server**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your MongoDB URI and JWT secret
   ```

3. **Start Server**
   ```bash
   cd server
   npm install
   npm run dev
   ```

4. **Start Client** (in a new terminal)
   ```bash
   cd client
   npm install
   npm run dev
   ```

5. **Open Browser**
   - Navigate to http://localhost:3000
   - Register a new account
   - Create a document
   - Open the document in multiple tabs/windows to test collaboration

## Testing Collaboration

1. Open the same document in two browser windows
2. Type in one window - you should see changes appear in the other
3. Test offline mode by disconnecting network, making edits, then reconnecting

## API Testing

Use curl or Postman to test the API:

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get documents (use token from login)
curl http://localhost:3001/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

- **MongoDB connection error**: Ensure MongoDB is running and MONGODB_URI is correct
- **WebSocket connection failed**: Check server is running on port 3001
- **CORS errors**: Server CORS is configured for localhost:3000

