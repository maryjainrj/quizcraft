# GitHub Copilot Instructions for QuizCraft

## Project Overview

QuizCraft is a full-stack question/quiz generation application that uses AI to generate questions from various file formats (PDF, DOCX, images). The application includes OCR capabilities and integrates with Hugging Face for AI-powered question generation.

## Tech Stack

### Backend
- **Framework**: Node.js with Express.js
- **Architecture**: MVC (Model-View-Controller)
- **Database**: MongoDB with Mongoose ODM
- **AI Integration**: Hugging Face API
- **OCR**: Google Cloud Vision API, Tesseract.js
- **File Processing**: pdf-parse, mammoth, pdfjs-dist
- **Authentication**: JWT, Google OAuth, bcrypt
- **API**: REST + GraphQL
- **Email**: Nodemailer (for password reset)

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Forms**: React Hook Form
- **Routing**: React Router DOM
- **PDF Export**: jsPDF, html2canvas

## Directory Structure

```
quizcraft/
├── backend/
│   ├── controllers/     # Business logic for routes
│   ├── models/          # Mongoose schemas (User, Question, Quiz, etc.)
│   ├── routes/          # Express route definitions
│   ├── middleware/      # Authentication and validation middleware
│   ├── utils/           # Helper functions
│   ├── graphql/         # GraphQL schema and resolvers
│   ├── server.js        # Main server entry point
│   └── .env             # Environment variables (not in git)
└── frontend/
    ├── src/
    │   ├── components/  # Reusable React components
    │   ├── services/    # API service functions
    │   ├── api/         # API endpoint definitions
    │   ├── utils/       # Helper functions
    │   ├── graphql/     # GraphQL queries and mutations
    │   ├── App.jsx      # Main app component
    │   └── main.jsx     # Entry point
    ├── public/          # Static assets
    └── dist/            # Build output (not in git)
```

## Coding Standards

### General Guidelines
- Write clean, maintainable code following JavaScript ES6+ standards
- Use meaningful variable and function names
- Add comments for complex logic, but prefer self-documenting code
- Keep functions small and focused on a single responsibility
- Follow DRY (Don't Repeat Yourself) principle

### Backend Standards
- Follow MVC architecture strictly
  - **Models**: Define in `backend/models/` using Mongoose schemas
  - **Controllers**: Business logic in `backend/controllers/`
  - **Routes**: HTTP endpoints in `backend/routes/`
- Use async/await for asynchronous operations, avoid callback hell
- Implement proper error handling with try-catch blocks
- Validate input data using Zod schemas
- Use middleware for authentication and authorization
- Keep routes thin - delegate business logic to controllers
- Use environment variables for configuration (stored in `.env`)

### Frontend Standards
- Use functional components with React Hooks (no class components)
- Keep components small and reusable
- Use Tailwind CSS utility classes for styling
- Organize component files: one component per file
- Use React Hook Form for form management
- Implement proper error handling and loading states
- Use Axios interceptors for API calls with authentication
- Follow React best practices for state management

### Naming Conventions
- **Files**: camelCase for JavaScript files (e.g., `userController.js`)
- **Components**: PascalCase for React components (e.g., `QuizGenerator.jsx`)
- **Variables/Functions**: camelCase (e.g., `getUserData`, `questionList`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `JWT_SECRET`)
- **Database Models**: PascalCase singular (e.g., `User`, `Question`, `QuestionSet`)

## Environment Variables

### Required Backend Variables
```
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
HUGGINGFACE_API_TOKEN=your_huggingface_api_token
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
FRONTEND_ORIGIN=http://localhost:5173
```

### Required Frontend Variables
```
VITE_API_BASE_URL=http://localhost:5000
```

## Testing Guidelines

Currently, the project does not have a test suite. When adding tests:
- Use Jest for backend unit and integration tests
- Use React Testing Library for frontend component tests
- Write tests for new features and bug fixes
- Focus on testing business logic and critical paths
- Mock external dependencies (APIs, databases)

## Security Best Practices

- **Never commit secrets**: Use `.env` files for sensitive data
- **Authentication**: Always validate JWT tokens on protected routes
- **Input Validation**: Sanitize and validate all user inputs using Zod
- **CORS**: Only allow trusted origins (configured in `server.js`)
- **Password Handling**: Use bcrypt with proper salt rounds (≥10)
- **File Uploads**: Validate file types and sizes, sanitize filenames
- **API Rate Limiting**: Implement rate limiting for public endpoints
- **SQL/NoSQL Injection**: Use parameterized queries and Mongoose properly

## Development Workflow

### Running Locally
1. **Backend**: `cd backend && npm run dev` (runs on port 5000)
2. **Frontend**: `cd frontend && npm run dev` (runs on port 5173)
3. Ensure MongoDB is accessible and environment variables are configured

### Building for Production
1. **Backend**: `cd backend && npm start`
2. **Frontend**: `cd frontend && npm run build` (outputs to `dist/`)

### Code Quality
- **Frontend Linting**: Run `npm run lint` in the frontend directory
- Fix linting errors before committing code
- Follow ESLint rules configured in `eslint.config.js`

## Dependencies Management

- Use `npm install` to add new dependencies
- Keep dependencies up to date but test thoroughly after updates
- Avoid adding unnecessary dependencies
- Check for security vulnerabilities using `npm audit`
- Document any new dependencies in README if they require special configuration

## API Design

### REST Endpoints
- Use RESTful conventions: GET (read), POST (create), PUT/PATCH (update), DELETE (delete)
- Use plural nouns for resource names (e.g., `/api/questions`, `/api/users`)
- Include proper HTTP status codes (200, 201, 400, 401, 404, 500, etc.)
- Return consistent JSON response format:
  ```json
  {
    "success": true,
    "data": {...},
    "message": "Optional message"
  }
  ```

### GraphQL
- Define schema in `backend/graphql/schema.js`
- Implement resolvers in `backend/graphql/resolvers.js`
- Use GraphQL for complex queries with nested relationships
- Keep REST for simple CRUD and file operations

## File Processing Guidelines

- Support PDF, DOCX, and image files (PNG, JPG, JPEG)
- Use appropriate parser: pdf-parse for PDFs, mammoth for DOCX
- Implement OCR using Google Cloud Vision API or Tesseract.js
- Validate file size and type before processing
- Clean up temporary files after processing
- Handle errors gracefully with user-friendly messages

## AI Integration

- Use Hugging Face Inference API for question generation
- Implement proper error handling for API failures
- Consider rate limits and API costs
- Cache results when appropriate to reduce API calls
- Validate AI-generated content before storing

## Database Design

- Use Mongoose schemas with proper validation
- Define relationships using refs and populate
- Index frequently queried fields for performance
- Keep schemas in `backend/models/`
- Use meaningful field names and add descriptions

## Common Tasks

### Adding a New Feature
1. Create/update model in `backend/models/` if database changes are needed
2. Create controller in `backend/controllers/` for business logic
3. Define routes in `backend/routes/`
4. Create frontend components in `frontend/src/components/`
5. Add API service functions in `frontend/src/services/`
6. Test the feature thoroughly
7. Update documentation if needed

### Fixing a Bug
1. Reproduce the bug and understand the issue
2. Check logs and error messages
3. Fix the root cause, not just the symptom
4. Test the fix thoroughly
5. Consider edge cases

### Refactoring
1. Ensure existing functionality works before starting
2. Make small, incremental changes
3. Keep tests passing (or add tests first)
4. Don't mix refactoring with new features

## Common Pitfalls to Avoid

- Don't expose sensitive data in API responses
- Don't store passwords in plain text
- Don't commit `.env` files or secrets
- Don't disable CORS in production without proper configuration
- Don't skip input validation
- Don't ignore error handling
- Don't create circular dependencies between modules
- Don't use synchronous file operations in request handlers

## Issue and PR Guidelines

When working on issues:
- Read the issue description carefully
- Ask for clarification if requirements are unclear
- Make minimal, focused changes
- Test changes thoroughly before submitting
- Update documentation if the change affects usage
- Follow the existing code style and patterns
