const { buildSchema } = require('graphql');

const schema = buildSchema(`
  """ --- Existing Quiz Types --- """
  type Question {
    id: ID!
    question: String!
    options: [String!]
    correctAnswer: String
    difficulty: String
    topic: String
    createdAt: String
  }

  """ --- Auth Types --- """
  type User {
    id: ID!
    username: String
    email: String!
    provider: String!
    createdAt: String
    updatedAt: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    username: String
    email: String!
    password: String!
  }

  """ --- Queries --- """
  type Query {
    # Your existing queries
    questions: [Question]
    question(id: ID!): Question
    questionsByTopic(topic: String!): [Question]

    # New utility queries
    _health: String!
    me: User
  }

  """ --- Mutations --- """
  type Mutation {
    # Your existing mutations
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

    # New auth mutations
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    googleAuth(credential: String!): AuthPayload!
  }
`);

module.exports = schema;
