# How to Collaborate on Documents

## Overview
Multiple users can edit the same document simultaneously with real-time synchronization. Each user sees colored cursors and selections from other users.

## Workflow

### Step 1: Create or Open a Document
1. Log in to your account
2. Click "+ New Document" to create a new document
3. Or click on an existing document to open it

### Step 2: Share the Document (Owner Only)
**As the document owner**, you can share it with other users:

1. Open the document you want to share
2. Click on your name in the editor header (top right)
3. Go to "Profile" → Look for sharing options
   - OR use the API directly: `POST /api/documents/:id/share`
   - Body: `{ "userId": "other-user-id", "role": "editor" }`

**Note:** Currently, sharing is done via API. A UI for sharing will be added.

### Step 3: Other Users Access the Document
**For other users to access:**

1. They need to be logged in
2. They can access shared documents in their "My Documents" list
3. Or use the direct URL: `http://localhost:5173/documents/[document-id]`

### Step 4: Real-Time Collaboration
Once multiple users are in the same document:

✅ **What you'll see:**
- **Your cursor**: Your own colored cursor as you type
- **Other users' cursors**: Colored cursors showing where others are editing
- **Selections**: Highlighted text selections from other users (in their color)
- **Real-time typing**: Text appears instantly for all users

✅ **Color System:**
- Each user gets a unique color based on their user ID
- Colors are consistent (same user = same color always)
- Available colors: Red, Green, Blue, Yellow, Magenta, Cyan

✅ **How it works:**
1. User A types "Hello" → Appears instantly for User B
2. User B types "World" → Appears instantly for User A
3. Both users see each other's cursors moving
4. All changes sync in real-time via WebSocket

## Testing Collaboration

### Quick Test (Same User, Multiple Tabs)
1. Open the document in **Browser Tab 1**
2. Open the same document in **Browser Tab 2** (same browser, different tab)
3. Move your cursor in Tab 1 → See it in Tab 2!
4. Type in Tab 1 → See text appear in Tab 2!

### Full Test (Different Users)
1. **User 1**: Register/Login → Create document → Note the document ID
2. **User 2**: Register/Login → Access the document (if shared) or use document ID
3. Both users open the same document
4. Type simultaneously → See each other's changes in real-time!

## Access Control

### Roles:
- **Owner**: Can edit, delete, and share the document
- **Editor**: Can edit the document
- **Viewer**: Can only view (read-only) - not yet implemented in UI

### Sharing via API:
```bash
# Share document with another user
POST /api/documents/:id/share
Authorization: Bearer YOUR_TOKEN
Body: {
  "userId": "other-user-id",
  "role": "editor"  // or "viewer"
}
```

## Current Limitations

- Sharing UI is not yet implemented (use API for now)
- All users with access can edit (viewer role not enforced in UI yet)
- Maximum recommended: 10-20 concurrent users per document

## Best Practices

1. **Document Size**: Keep documents under 1MB for best performance
2. **Concurrent Users**: Works best with 2-10 users simultaneously
3. **Network**: Requires stable internet connection for real-time sync
4. **Offline**: Changes are queued and synced when connection is restored

