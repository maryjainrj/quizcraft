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

  type Query {
    questions: [Question]
    question(id: ID!): Question
    questionsByTopic(topic: String!): [Question]
  }

  type Mutation {
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
  }
`);

module.exports = schema;
