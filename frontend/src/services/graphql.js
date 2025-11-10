// frontend/src/services/graphql.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export const graphqlQuery = async (query, variables = {}) => {
  const token = localStorage.getItem("token"); // JWT from login

  if (!token) {
    throw new Error("No authentication token found. Please log in.");
  }

  const response = await fetch(`${API_BASE}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`, // include JWT
    },
    body: JSON.stringify({ query, variables }),
  });

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`GraphQL HTTP error ${response.status}`);
  }

  const { data, errors } = json;

  if (!response.ok) {
    const msg =
      errors?.[0]?.message ||
      json?.message ||
      `GraphQL HTTP error ${response.status}`;
    throw new Error(msg);
  }

  if (errors && errors.length) {
    throw new Error(errors[0]?.message || "GraphQL error occurred");
  }

  return data;
};
