const Question = require('../models/Question');

const resolvers = {
  // Query resolvers
  questions: async () => {
    try {
      return await Question.find();
    } catch (error) {
      throw new Error('Error fetching questions');
    }
  },

  question: async ({ id }) => {
    try {
      return await Question.findById(id);
    } catch (error) {
      throw new Error('Error fetching question');
    }
  },

  questionsByTopic: async ({ topic }) => {
    try {
      return await Question.find({ topic });
    } catch (error) {
      throw new Error('Error fetching questions by topic');
    }
  },

  // Mutation resolvers
  createQuestion: async ({ question, options, correctAnswer, difficulty, topic }) => {
    try {
      const newQuestion = new Question({
        question,
        options,
        correctAnswer,
        difficulty,
        topic
      });
      return await newQuestion.save();
    } catch (error) {
      throw new Error('Error creating question');
    }
  },

  updateQuestion: async ({ id, ...updates }) => {
    try {
      return await Question.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true }
      );
    } catch (error) {
      throw new Error('Error updating question');
    }
  },

  deleteQuestion: async ({ id }) => {
    try {
      await Question.findByIdAndDelete(id);
      return true;
    } catch (error) {
      throw new Error('Error deleting question');
    }
  }
};

module.exports = resolvers;