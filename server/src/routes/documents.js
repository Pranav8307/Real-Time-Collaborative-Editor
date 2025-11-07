import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Document from '../models/Document.js';
import logger from '../utils/logger.js';
import { httpRequestTotal, httpRequestDuration } from '../utils/metrics.js';

const router = express.Router();

// Metrics middleware
const trackMetrics = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status: res.statusCode },
      duration
    );
    httpRequestTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });
  next();
};

router.use(trackMetrics);
router.use(authenticate);

// Get all documents user has access to
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    
    const documents = await Document.find({
      $or: [
        { ownerId: userId },
        { 'accessControl.userId': userId },
      ],
      isDeleted: false,
    })
      .populate('ownerId', 'name email')
      .sort({ lastModified: -1 })
      .limit(100);
    
    res.json(documents.map(doc => ({
      id: doc._id,
      title: doc.title,
      ownerId: doc.ownerId,
      accessControl: doc.accessControl,
      version: doc.version,
      lastModified: doc.lastModified,
      createdAt: doc.createdAt,
    })));
  } catch (error) {
    logger.error({ error }, 'Failed to get documents');
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// Get single document
router.get('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document || document.isDeleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check access
    const hasAccess = document.ownerId.toString() === req.user._id.toString() ||
      document.accessControl.some(acl => acl.userId.toString() === req.user._id.toString());
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      id: document._id,
      title: document.title,
      ownerId: document.ownerId,
      accessControl: document.accessControl,
      version: document.version,
      lastModified: document.lastModified,
      createdAt: document.createdAt,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get document');
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Create document
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const document = new Document({
      title,
      ownerId: req.user._id,
      accessControl: [{
        userId: req.user._id,
        role: 'owner',
      }],
    });
    
    await document.save();
    
    logger.info({ documentId: document._id, userId: req.user._id }, 'Document created');
    
    res.status(201).json({
      id: document._id,
      title: document.title,
      ownerId: document.ownerId,
      accessControl: document.accessControl,
      version: document.version,
      lastModified: document.lastModified,
      createdAt: document.createdAt,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create document');
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Update document (title, access control)
router.patch('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document || document.isDeleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only owner can update
    if (document.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only owner can update document' });
    }
    
    if (req.body.title) {
      document.title = req.body.title;
    }
    
    if (req.body.accessControl) {
      document.accessControl = req.body.accessControl;
    }
    
    document.lastModified = new Date();
    await document.save();
    
    logger.info({ documentId: document._id, userId: req.user._id }, 'Document updated');
    
    res.json({
      id: document._id,
      title: document.title,
      ownerId: document.ownerId,
      accessControl: document.accessControl,
      version: document.version,
      lastModified: document.lastModified,
      createdAt: document.createdAt,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update document');
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document || document.isDeleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only owner can delete
    if (document.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only owner can delete document' });
    }
    
    document.isDeleted = true;
    document.lastModified = new Date();
    await document.save();
    
    logger.info({ documentId: document._id, userId: req.user._id }, 'Document deleted');
    
    res.json({ message: 'Document deleted' });
  } catch (error) {
    logger.error({ error }, 'Failed to delete document');
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Share document (add access control)
router.post('/:id/share', async (req, res) => {
  try {
    const { userId, email, role } = req.body;
    
    if (!role || !['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "editor" or "viewer"' });
    }
    
    // If email provided, find user by email
    let targetUserId = userId;
    if (email && !userId) {
      const User = (await import('../models/User.js')).default;
      const targetUser = await User.findOne({ email: email.toLowerCase() });
      if (!targetUser) {
        return res.status(404).json({ error: 'User with this email not found' });
      }
      targetUserId = targetUser._id.toString();
    }
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Either userId or email is required' });
    }
    
    const document = await Document.findById(req.params.id);
    
    if (!document || document.isDeleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only owner can share
    if (document.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only owner can share document' });
    }
    
    // Can't share with yourself
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot share document with yourself' });
    }
    
    // Check if already shared
    const existingAcl = document.accessControl.find(
      acl => acl.userId.toString() === targetUserId
    );
    
    if (existingAcl) {
      existingAcl.role = role;
    } else {
      document.accessControl.push({ userId: targetUserId, role });
    }
    
    document.lastModified = new Date();
    await document.save();
    
    logger.info({ documentId: document._id, sharedWith: targetUserId, role }, 'Document shared');
    
    res.json({
      id: document._id,
      accessControl: document.accessControl,
      message: 'Document shared successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to share document');
    res.status(500).json({ error: 'Failed to share document' });
  }
});

export default router;

