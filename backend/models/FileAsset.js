// backend/models/FileAsset.js
const mongoose = require('mongoose');

const fileAssetSchema = new mongoose.Schema(
  {
    owner: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    extractedText: { type: String },
    extractionMethod: { 
      type: String, 
      enum: ['pdf-parse', 'google-vision', 'client-side', 'none'],
      default: 'none'
    },
    extractionStats: {
      pageCount: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 }
    },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'completed'
    }
  },
  { timestamps: true }
);

fileAssetSchema.index({ owner: 1, createdAt: -1 });

fileAssetSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.models.FileAsset || mongoose.model('FileAsset', fileAssetSchema);