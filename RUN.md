# How to Run Nimbus Collaborative Editor

## Quick Start (Two Terminal Windows)

### Terminal 1 - Server
```bash
cd nimbus-collab/server
npm install
npm run dev
```

### Terminal 2 - Client  
```bash
cd nimbus-collab/client
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Detailed Steps

### 1. First Time Setup

**Install Server Dependencies:**
```bash
cd nimbus-collab/server
npm install
```

**Install Client Dependencies:**
```bash
cd nimbus-collab/client
npm install
```

**Create Server Environment File:**
```bash
cd nimbus-collab/server
# Copy the example .env file (if it doesn't exist)
copy .env.example .env
# Or create it manually with:
# PORT=3001
# MONGODB_URI=mongodb://localhost:27017/nimbus-collab
# JWT_SECRET=your-super-secret-jwt-key
# JWT_EXPIRES_IN=7d
```

### 2. Start MongoDB
Make sure MongoDB is running:
```bash
# If MongoDB is installed as a service, it should already be running
# Otherwise, start it manually
mongod
```

### 3. Run the Project

**Option A: Two Separate Terminals (Recommended)**

**Terminal 1 - Start Server:**
```bash
cd C:\Users\prana\OneDrive\Desktop\FULLStack\nimbus-collab\server
npm run dev
```
You should see:
```
[INFO] MongoDB connected successfully
[INFO] Server started
    port: 3001
```

**Terminal 2 - Start Client:**
```bash
cd C:\Users\prana\OneDrive\Desktop\FULLStack\nimbus-collab\client
npm run dev
```
You should see:
```
VITE v7.2.1  ready in XXX ms
➜  Local:   http://localhost:5173/
```

**Option B: Using Batch Files (Windows)**

Double-click `start-all.bat` in the project root, or run:
```bash
cd nimbus-collab
start-all.bat
```

### 4. Access the Application

- **Client (Main App)**: http://localhost:5173
- **Server API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health

---

## Available Scripts

### Server Scripts
```bash
cd server
npm start      # Production mode
npm run dev    # Development mode with auto-reload
```

### Client Scripts
```bash
cd client
npm run dev    # Development server
npm run build  # Build for production
npm run preview # Preview production build
```

---

## Troubleshooting

### Port Already in Use
If port 3001 or 5173 is already in use:
- **Server**: Change `PORT` in `server/.env`
- **Client**: Change port in `client/vite.config.js`

### MongoDB Connection Error
- Make sure MongoDB is running
- Check `MONGODB_URI` in `server/.env`
- Default: `mongodb://localhost:27017/nimbus-collab`

### Module Not Found Errors
```bash
# Reinstall dependencies
cd server && npm install
cd ../client && npm install
```

---

## Testing the Application

1. Open http://localhost:5173
2. Click "Register" to create an account
3. After login, click "+ New Document"
4. Open the document in multiple browser tabs to test collaboration

---

## Stopping the Servers

Press `Ctrl + C` in each terminal window to stop the servers.

