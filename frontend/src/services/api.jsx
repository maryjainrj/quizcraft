// src/services/api.js
const API_URL = 'http://localhost:5000';
const GRAPHQL_URL = `${API_URL}/graphql`;

const graphqlRequest = async (query, variables = {}) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Unauthenticated: Please log in first.');
  }

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`GraphQL HTTP error ${response.status}`);
  }

  const { data, errors, message } = json;
  if (!response.ok) {
    throw new Error(errors?.[0]?.message || message || `GraphQL HTTP error ${response.status}`);
  }
  if (errors && errors.length) {
    throw new Error(errors[0]?.message || 'GraphQL error occurred');
  }
  return data;
};

export const fetchAllQuestions = async () => {
  const query = `
    query {
      myQuestions {
        id
        text
        type
        options {
          option_index
          option_text
          is_correct
        }
        correctText
        difficulty
        category
        createdAt
      }
    }
  `;

  const data = await graphqlRequest(query);
  return data.myQuestions || [];
};

export const searchQuestionsByTopic = async (topic) => {
  // Since the schema doesn't have questionsByTopic, 
  // we'll fetch all questions and filter on the frontend
  const allQuestions = await fetchAllQuestions();
  if (!topic || !topic.trim()) return allQuestions;
  
  const searchTerm = topic.toLowerCase();
  return allQuestions.filter(q => 
    (q.text && q.text.toLowerCase().includes(searchTerm)) ||
    (q.category && q.category.toLowerCase().includes(searchTerm)) ||
    (q.tags && q.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
  );
};

export const createQuestion = async (formData) => {
  // The current GraphQL schema doesn't support creating individual questions
  // Questions are created as part of QuestionSets
  throw new Error("Creating individual questions is not supported. Please create a quiz/question set instead.");
};

export const updateQuestion = async (id, formData) => {
  // The current GraphQL schema doesn't support updating individual questions
  // Questions are managed as part of QuestionSets
  throw new Error("Updating individual questions is not supported. Please edit the quiz/question set instead.");
};

export const deleteQuestion = async (id) => {
  // The current GraphQL schema doesn't support deleting individual questions
  // Questions are managed as part of QuestionSets
  throw new Error("Deleting individual questions is not supported. Please delete the quiz/question set instead.");
};

// Quiz management endpoints
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export const deleteQuiz = async (quizId) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/api/questionsets/${quizId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete quiz');
  }

  return await response.json();
};

export const updateQuiz = async (quizId, updates) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/api/questionsets/${quizId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update quiz');
  }

  return await response.json();
};