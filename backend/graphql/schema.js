const { buildSchema } = require('graphql');

const schema = buildSchema(`
  type Question {
    id: ID!
    question: String!
    options: [String!]
    correctAnswer: String
    difficulty: String
    topic: String
    createdAt: String
  }

  # --- Added: User & Auth payloads ---
  type User {
    id: ID!
    name: String
    email: String!
    provider: String!
    avatarUrl: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    questions: [Question]
    question(id: ID!): Question
    questionsByTopic(topic: String!): [Question]
  }

  type Mutation {
    # existing question mutations
    createQuestion(
      question: String!
      options: [String!]
      correctAnswer: String
      difficulty: String
      topic: String
    ): Question

    updateQuestion(
      id: ID!
      question: String
      options: [String]
      correctAnswer: String
      difficulty: String
      topic: String
    ): Question

    deleteQuestion(id: ID!): Boolean

    # --- Added: auth mutations (mirror quizcraft_mine) ---
    register(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    googleLogin(credential: String!): AuthPayload!
  }
`);

module.exports = schema;
