// backend/models/QuestionSet.js
const mongoose = require('mongoose');

const questionSetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    
    // Settings 
    settings: {
      types: [String], // ['mcq', 'true-false', 'fill-in-blank']
      count: { type: Number, default: 5 },
      difficulty: { 
        type: String, 
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
      },
      category: { type: String }
    },
    
    // Store original questions JSON for backup/history
    originalQuestionsJSON: { type: String },
    
    // Questions with order (questionset_questions junction table in ER)
    questions: [{
      question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionNew' },
      question_order: { type: Number }
    }],
    
    // Source files (questionset_sourcefiles junction table in ER)
    sourceFiles: [{
      fileAsset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' }
    }],
    
    status: { 
      type: String, 
      enum: ['draft', 'active', 'archived'],
      default: 'active'
    },
    
    version: { type: Number, default: 1 },
    
    pdfUrl: { type: String }, // Generated PDF URL
    
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

questionSetSchema.index({ createdBy: 1, createdAt: -1 });
questionSetSchema.index({ status: 1 });

questionSetSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.models.QuestionSet || mongoose.model('QuestionSet', questionSetSchema);