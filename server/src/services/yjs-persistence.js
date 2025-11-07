import * as Y from 'yjs';
import Document from '../models/Document.js';
import DocumentSnapshot from '../models/DocumentSnapshot.js';
import OperationLog from '../models/OperationLog.js';
import logger from '../utils/logger.js';
import { opsCounter, opsLatency } from '../utils/metrics.js';

const SNAPSHOT_INTERVAL = 100; // Create snapshot every 100 operations
const MAX_OPERATION_AGE_DAYS = 30; // Keep operations for 30 days

export class YjsPersistence {
  constructor() {
    this.documents = new Map(); // In-memory Y.Doc cache
    this.operationCounts = new Map(); // Track ops per document
  }

  async getOrCreateDocument(documentId) {
    if (this.documents.has(documentId)) {
      return this.documents.get(documentId);
    }

    const doc = new Y.Doc();
    const document = await Document.findById(documentId);
    
    if (document && document.content) {
      try {
        Y.applyUpdate(doc, document.content);
        logger.info({ documentId }, 'Loaded document from snapshot');
      } catch (error) {
        logger.error({ error, documentId }, 'Failed to load document snapshot');
      }
    }

    // Load recent operations
    const recentOps = await OperationLog.find({
      documentId,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    }).sort({ version: 1 }).limit(1000);

    for (const op of recentOps) {
      try {
        Y.applyUpdate(doc, op.operation);
      } catch (error) {
        logger.warn({ error, documentId, opId: op._id }, 'Failed to apply operation');
      }
    }

    this.documents.set(documentId, doc);
    this.operationCounts.set(documentId, 0);
    
    return doc;
  }

  async saveUpdate(documentId, update, clientId, vectorClock) {
    const startTime = Date.now();
    
    try {
      const doc = await this.getOrCreateDocument(documentId);
      
      // Apply update to in-memory doc
      Y.applyUpdate(doc, update);
      
      // Increment operation count
      const opCount = (this.operationCounts.get(documentId) || 0) + 1;
      this.operationCounts.set(documentId, opCount);
      
      // Get current document version
      const document = await Document.findById(documentId);
      const version = (document?.version || 0) + 1;
      
      // Save operation log
      const operationLog = new OperationLog({
        documentId,
        operation: Buffer.from(update),
        clientId,
        vectorClock: vectorClock || new Map(),
        version,
      });
      await operationLog.save();
      
      // Update document version
      await Document.findByIdAndUpdate(documentId, {
        version,
        lastModified: new Date(),
      });
      
      // Create snapshot periodically
      if (opCount % SNAPSHOT_INTERVAL === 0) {
        await this.createSnapshot(documentId, doc, version);
      }
      
      const latency = (Date.now() - startTime) / 1000;
      opsLatency.observe({ document_id: documentId.toString(), operation_type: 'update' }, latency);
      opsCounter.inc({ document_id: documentId.toString(), operation_type: 'update' });
      
      logger.debug({ documentId, version, latency }, 'Saved update');
      
      return { success: true, version };
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to save update');
      throw error;
    }
  }

  async createSnapshot(documentId, doc, version) {
    try {
      const state = Y.encodeStateAsUpdate(doc);
      
      const snapshot = new DocumentSnapshot({
        documentId,
        state: Buffer.from(state),
        version,
      });
      await snapshot.save();
      
      // Update document with latest snapshot
      await Document.findByIdAndUpdate(documentId, {
        content: Buffer.from(state),
      });
      
      // Cleanup old snapshots (keep only latest 5)
      const oldSnapshots = await DocumentSnapshot.find({ documentId })
        .sort({ version: -1 })
        .skip(5);
      
      if (oldSnapshots.length > 0) {
        await DocumentSnapshot.deleteMany({
          _id: { $in: oldSnapshots.map(s => s._id) },
        });
      }
      
      logger.info({ documentId, version }, 'Created snapshot');
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to create snapshot');
    }
  }

  async getStateVector(documentId) {
    const doc = await this.getOrCreateDocument(documentId);
    return Y.encodeStateVector(doc);
  }

  async getMissingUpdates(documentId, stateVector) {
    try {
      const doc = await this.getOrCreateDocument(documentId);
      return Y.encodeStateAsUpdate(doc, stateVector);
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to get missing updates');
      return null;
    }
  }

  async cleanupOldOperations() {
    try {
      const cutoffDate = new Date(Date.now() - MAX_OPERATION_AGE_DAYS * 24 * 60 * 60 * 1000);
      const result = await OperationLog.deleteMany({
        timestamp: { $lt: cutoffDate },
      });
      logger.info({ deleted: result.deletedCount }, 'Cleaned up old operations');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup old operations');
    }
  }

  // Cleanup in-memory cache periodically
  clearCache(documentId) {
    if (documentId) {
      this.documents.delete(documentId);
      this.operationCounts.delete(documentId);
    } else {
      this.documents.clear();
      this.operationCounts.clear();
    }
  }
}

export default new YjsPersistence();

