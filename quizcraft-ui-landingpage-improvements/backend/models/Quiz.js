// backend/models/Quiz.js
const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    questions: [
      {
        question: { type: String, required: true },
        type: { type: String, enum: ['multiple-choice', 'true-false', 'fill-in-blank'], required: true },
        options: [String], // For multiple-choice
        correctAnswer: { type: String, required: true },
      },
    ],
    fileNames: [String],
    settings: {
      questionCount: Number,
      questionType: String,
      difficulty: String,
      language: String,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Transform for JSON output
quizSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    
    // Transform createdBy if it's populated
    if (ret.createdBy && ret.createdBy._id) {
      ret.createdBy = {
        id: ret.createdBy._id.toString(),
        username: ret.createdBy.username || ret.createdBy.name || '',
        email: ret.createdBy.email,
        provider: ret.createdBy.provider,
      };
    } else if (ret.createdBy) {
      // If not populated, just convert ObjectId to string
      ret.createdBy = ret.createdBy.toString();
    }
    
    return ret;
  },
});

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);