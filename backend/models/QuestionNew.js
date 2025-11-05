// backend/models/QuestionNew.js
const mongoose = require('mongoose');

// Main Question Schema following ER diagram
const questionSchema = new mongoose.Schema(
  {
    type: { 
      type: String, 
      enum: ['mcq', 'short-answer', 'true-false', 'fill-in-blank'],
      required: true 
    },
    text: { type: String, required: true },
    category: { type: String },
    difficulty: { 
      type: String, 
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    explanation: { type: String },
    source: { type: String },
    correctText: { type: String }, // For true-false, fill-in-blank, short-answer
    
    // Embedded options (from question_options table in ER)
    options: [{
      option_index: Number,
      option_text: String,
      is_correct: Boolean
    }],
    
    // Embedded tags (from question_tags table in ER)
    tags: [String]
  },
  { timestamps: true }
);

questionSchema.index({ type: 1, difficulty: 1, category: 1 });

questionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.models.QuestionNew || mongoose.model('QuestionNew', questionSchema);