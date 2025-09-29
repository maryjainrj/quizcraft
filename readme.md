# Question Generator App Setup

## Prerequisites
- Node.js v20+ ([nodejs.org](https://nodejs.org))
- MongoDB Atlas URI ([mongodb.com/atlas](https://www.mongodb.com/atlas))
- Hugging Face API token ([huggingface.co](https://huggingface.co/settings/tokens))

## Setup Instructions

### 1. Clone Project
1. Clone the repository and navigate to project folder:

   git clone https://github.com/Arya-hue-dotcom/quizcraft.git
   
2. Create backend and frontend folders:

   mkdir backend frontend (already there no need to cerate this dir)


### 2. Backend Setup (Node.js/Express with MVC)
1. Navigate to backend:
   cd backend

2. Initialize npm:

   npm init -y

3. Install dependencies:
   npm install express multer pdf-parse mammoth mongoose dotenv zod @huggingface/inference jszip docx jspdf tesseract.js cors
   npm install --save-dev nodemon

4. Create `.env` file:
   
   touch .env

   Add to `.env`:

   PORT=5000
   MONGO_URI=your_mongodb_atlas_uri
   HUGGINGFACE_API_TOKEN=your_huggingface_api_token

5. Create MVC structure:
   mkdir models controllers routes
   touch server.js models/question.js controllers/questionController.js routes/questionRoutes.js

6. Run backend:
   npm run dev

### 3. Frontend Setup (Vite with React)
1. Navigate to frontend:
   cd ../frontend
2. Initialize Vite with React:

   npm create vite@latest . -- --template react
   - Select **React** and **JavaScript**.
3. Install dependencies:
   npm install axios react-hook-form jspdf docx
4. Run frontend:
   npm run dev

### 4. Test Setup
- Run backend: `cd backend && npm run dev` (port 5000).
- Run frontend: `cd frontend && npm run dev` (port 5173).
- Test: Check `http://localhost:5173` in browser and `http://localhost:5000/api/questions/test` in Postman.

### Troubleshooting
- **MongoDB**: Verify `MONGO_URI` and whitelist IP in Atlas.
- **Dependencies**: Run `npm install` if errors occur.
- **Ports**: Change ports in `.env` or Vite config if conflicts.