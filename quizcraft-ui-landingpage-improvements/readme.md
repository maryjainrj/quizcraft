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
   npm install pdfjs-dist@3.4.120

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
2. Initialize Vite with React:(already completed ignore)

   npm create vite@latest . -- --template react
   - Select **React** and **JavaScript**.
3. Install dependencies:
   npm install axios react-hook-form jspdf docx
   npm install react-icons
   npm install lucide-react
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   npm i jspdf html2canvas
   npm install jspdf
   npm install lucide-react

   ## tail wind integration ##########
cd client
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
Step 2: Configure Tailwind
Open client/tailwind.config.js and replace with:
javascript/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
Step 3: Add Tailwind to CSS
Open client/src/index.css and replace everything with:
css@tailwind base;
@tailwind components;
@tailwind utilities;

/* Optional: Add any custom styles below */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
}
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

### added pdfjs 
**npm install pdfjs-dist**

**if pdf parse error comes in**
**npm install pdfjs-dist@3.4.120**
**npm install pdf-parse**