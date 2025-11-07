import mongoose from 'mongoose';

const operationLogSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true,
  },
  operation: {
    type: Buffer, // Yjs update binary
    required: true,
  },
  clientId: {
    type: String,
    required: true,
  },
  vectorClock: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  version: {
    type: Number,
    required: true,
    index: true,
  },
});

// Compound index for efficient queries
operationLogSchema.index({ documentId: 1, version: 1 });
operationLogSchema.index({ documentId: 1, timestamp: 1 });

export default mongoose.model('OperationLog', operationLogSchema);

