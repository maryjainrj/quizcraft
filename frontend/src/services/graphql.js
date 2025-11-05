// src/services/graphql.js
export const graphqlQuery = async (query, variables = {}) => {
  const token = localStorage.getItem('token'); // Retrieve JWT from localStorage

  if (!token) {
    throw new Error('No authentication token found. Please log in.');
  }

  const response = await fetch('http://localhost:5000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`, // Include JWT for authentication
    },
    body: JSON.stringify({ query, variables }),
  });

  const { data, errors } = await response.json();

  if (errors) {
    throw new Error(errors[0]?.message || 'GraphQL error occurred');
  }

  return data;
};