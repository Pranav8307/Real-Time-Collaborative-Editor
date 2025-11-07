import mongoose from 'mongoose';

const snapshotSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true,
  },
  state: {
    type: Buffer,
    required: true,
  },
  version: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound index for efficient queries
snapshotSchema.index({ documentId: 1, version: -1 });

export default mongoose.model('DocumentSnapshot', snapshotSchema);

