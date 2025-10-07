// src/services/api.js
const API_URL = 'http://localhost:5000';
const GRAPHQL_URL = `${API_URL}/graphql`;

const graphqlRequest = async (query, variables = {}) => {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0].message);
  }

  return data.data;
};

export const fetchAllQuestions = async () => {
  const query = `
    query {
      questions {
        id
        question
        options
        correctAnswer
        difficulty
        topic
        createdAt
      }
    }
  `;

  const data = await graphqlRequest(query);
  return data.questions || [];
};

export const searchQuestionsByTopic = async (topic) => {
  const query = `
    query($topic: String!) {
      questionsByTopic(topic: $topic) {
        id
        question
        options
        correctAnswer
        difficulty
        topic
        createdAt
      }
    }
  `;

  const data = await graphqlRequest(query, { topic });
  return data.questionsByTopic || [];
};

export const createQuestion = async (formData) => {
  const mutation = `
    mutation($question: String!, $options: [String!], $correctAnswer: String, $difficulty: String, $topic: String) {
      createQuestion(
        question: $question
        options: $options
        correctAnswer: $correctAnswer
        difficulty: $difficulty
        topic: $topic
      ) {
        id
        question
        options
        correctAnswer
        difficulty
        topic
      }
    }
  `;

  const data = await graphqlRequest(mutation, formData);
  return data.createQuestion;
};

export const updateQuestion = async (id, formData) => {
  const mutation = `
    mutation($id: ID!, $question: String, $options: [String], $correctAnswer: String, $difficulty: String, $topic: String) {
      updateQuestion(
        id: $id
        question: $question
        options: $options
        correctAnswer: $correctAnswer
        difficulty: $difficulty
        topic: $topic
      ) {
        id
        question
        options
        correctAnswer
        difficulty
        topic
      }
    }
  `;

  const data = await graphqlRequest(mutation, { id, ...formData });
  return data.updateQuestion;
};

export const deleteQuestion = async (id) => {
  const mutation = `
    mutation($id: ID!) {
      deleteQuestion(id: $id)
    }
  `;

  const data = await graphqlRequest(mutation, { id });
  return data.deleteQuestion;
};