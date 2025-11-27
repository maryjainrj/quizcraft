// backend/graphql/schemaER.js
const { buildSchema } = require('graphql');

const schema = buildSchema(`
  """ --- User Type --- """
  type User {
    id: ID!
    name: String
    email: String!
    role: String
    status: String
    createdAt: String
    updatedAt: String
  }

  """ --- FileAsset Type --- """
  type FileAsset {
    id: ID!
    owner: User!
    originalName: String!
    mimeType: String!
    size: Int!
    storagePath: String!
    extractedText: String
    extractionMethod: String
    extractionStats: ExtractionStats
    status: String!
    createdAt: String!
    updatedAt: String!
  }

  type ExtractionStats {
    pageCount: Int
    durationMs: Int
  }

  """ --- Question Type --- """
  type QuestionOption {
    option_index: Int!
    option_text: String!
    is_correct: Boolean!
  }

  type QuestionNew {
    id: ID!
    type: String!
    text: String!
    category: String
    difficulty: String!
    explanation: String
    source: String
    correctText: String
    options: [QuestionOption!]
    tags: [String!]
    createdAt: String!
    updatedAt: String!
  }

  """ --- QuestionSet Type --- """
  type QuestionSetSettings {
    types: [String!]
    count: Int
    difficulty: String
    category: String
  }

  type QuestionSetQuestion {
    question: QuestionNew!
    question_order: Int!
  }

  type QuestionSetSourceFile {
    fileAsset: FileAsset!
  }

  type QuestionSet {
    id: ID!
    title: String!
    settings: QuestionSetSettings
    questions: [QuestionSetQuestion!]!
    sourceFiles: [QuestionSetSourceFile!]
    status: String!
    version: Int!
    pdfUrl: String
    createdBy: User!
    createdAt: String!
    updatedAt: String!
  }

  """ --- Simplified QuestionSet (for listing) --- """
  type QuestionSetSimple {
    id: ID!
    title: String!
    settings: QuestionSetSettings
    pdfUrl: String
    status: String!
    createdAt: String!
    sourceFileNames: [String!]
    questionCount: Int!
  }

  """ --- Input Types --- """
  input QuestionOptionInput {
    option_index: Int!
    option_text: String!
    is_correct: Boolean!
  }

  input QuestionInput {
    type: String!
    text: String!
    category: String
    difficulty: String
    explanation: String
    source: String
    correctText: String
    options: [QuestionOptionInput!]
    tags: [String!]
  }

  input QuestionSetSettingsInput {
    types: [String!]
    count: Int
    difficulty: String
    category: String
  }

  input FileAssetInput {
    originalName: String!
    mimeType: String!
    size: Int!
    storagePath: String!
    extractedText: String
  }

  """ --- Auth Types --- """
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
    _health: String!
    me: User
    
    # QuestionSets (Quizzes)
    myQuestionSets: [QuestionSetSimple!]!
    questionSet(id: ID!): QuestionSet
    
    # Questions
    myQuestions: [QuestionNew!]!
    question(id: ID!): QuestionNew
    
    # FileAssets
    myFileAssets: [FileAsset!]!
    fileAsset(id: ID!): FileAsset
  }

  """ --- Mutations --- """
  type Mutation {
    # Auth
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    googleAuth(credential: String!): AuthPayload!
    
    # QuestionSet (Quiz) Operations
    createQuestionSet(
      title: String!
      questions: [QuestionInput!]!
      fileAssets: [FileAssetInput!]
      settings: QuestionSetSettingsInput
      pdfUrl: String
    ): QuestionSet!
    
    updateQuestionSet(
      id: ID!
      title: String
      status: String
    ): QuestionSet!
    
    deleteQuestionSet(id: ID!): Boolean!
    
    # FileAsset Operations
    createFileAsset(
      originalName: String!
      mimeType: String!
      size: Int!
      storagePath: String!
      extractedText: String
    ): FileAsset!
  }
`);

module.exports = schema;