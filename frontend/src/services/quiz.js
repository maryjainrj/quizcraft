// src/services/quiz.js
import { graphqlQuery } from './graphql'; // Import the helper from Step 2

export const saveQuizToDB = async (title, questions, fileNames, settings) => {
  // Define the GraphQL mutation as a string
  const mutation = `
    mutation SaveQuiz($title: String!, $questions: [QuizQuestionInput!]!, $fileNames: [String!]!, $settings: QuizSettingsInput) {
      saveQuiz(title: $title, questions: $questions, fileNames: $fileNames, settings: $settings) {
        id
        title
        questions {
          question
          type
          options
          correctAnswer  # This includes the answer
        }
        fileNames
        settings {
          questionCount
          questionType
          difficulty
          language
        }
        createdAt
        createdBy {
          id
          username
          email
        }
      }
    }
  `;

  // Prepare variables matching the input types
  const variables = {
    title,
    questions: questions.map(q => ({
      question: q.question,
      type: q.type, // e.g., 'multiple-choice', 'true-false', 'fill-in-blank'
      options: q.options || [], // Empty array if not MCQ
      correctAnswer: q.correctAnswer, // This is the answer
    })),
    fileNames: fileNames || [],
    settings: {
      questionCount: settings.count || settings.questionCount,
      questionType: settings.questionType || settings.questionTypes?.join(',') || '', // Handle array or string
      difficulty: settings.difficulty,
      language: settings.language,
    },
  };

  // Call the GraphQL helper
  const data = await graphqlQuery(mutation, variables);

  // Return the saved quiz (optional, for frontend use)
  return data.saveQuiz;
};