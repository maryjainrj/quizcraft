# QuizCraft - Developer Setup Guide

## Prerequisites
- **Node.js** v20+ ([Download](https://nodejs.org))
- **MongoDB** account ([MongoDB Atlas](https://www.mongodb.com/atlas))
- **Google Cloud Console** account (for OAuth)
- **HuggingFace** account (for AI features)
- **Mailtrap** account (for email testing)

---

## Quick Start for New Developers

### 1. Clone the Repository
```bash
git clone https://github.com/greeshmaprasad72/quizcraft.git
cd quizcraft
```

### 2. Backend Setup

#### a) Install Dependencies
```bash
cd backend
npm install
```

#### b) Configure Environment Variables
**Create a `.env` file by copying the example:**
```bash
cp .env.example .env
```

**Then edit `.env` and fill in your actual values:**

```env
PORT=5000

# 1. MongoDB Atlas
# - Go to: https://www.mongodb.com/atlas
# - Create a free cluster
# - Click "Connect" > "Connect your application"
# - Copy the connection string
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/QuizCraft?retryWrites=true&w=majority

# 2. JWT Secret
# - Generate a secure random string (minimum 32 characters)
# - You can use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-generated-jwt-secret-here

# 3. Google OAuth
# - Go to: https://console.cloud.google.com
# - Create a new project or select existing
# - Enable Google+ API
# - Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client ID"
# - Application type: Web application
# - Authorized JavaScript origins: http://localhost:5173
# - Authorized redirect URIs: http://localhost:5173
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# 4. HuggingFace API
# - Go to: https://huggingface.co/settings/tokens
# - Create a new token with "Read" access
# - Copy the token (starts with hf_)
HUGGINGFACE_API_KEY=hf_your_token_here
HF_CHAT_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# 5. Google Cloud Vision (Optional - for OCR)
# - Go to: https://console.cloud.google.com
# - Enable Cloud Vision API
# - Create a service account
# - Download the JSON key file
# - Place it in backend folder as 'service-account.json'
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# 6. Email Configuration (Development)
# - Go to: https://mailtrap.io
# - Sign up for free account
# - Go to "Email Testing" > "Inboxes" > Your inbox
# - Copy SMTP credentials
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
MAIL_FROM="QuizCraft <no-reply@quizcraft.local>"

# 7. Development Settings
DEV_BYPASS_MAIL=1
FRONTEND_ORIGIN=http://localhost:5173
```

#### c) Start Backend Server
```bash
npm run dev
```
Backend should run on **http://localhost:5000**

---

### 3. Frontend Setup

#### a) Install Dependencies
```bash
cd ../frontend
npm install
```

#### b) Configure Environment Variables
**Create a `.env` file by copying the example:**
```bash
cp .env.example .env
```

**Then edit `.env` and add:**

```env
# Backend API URL
VITE_API_BASE=http://localhost:5000

# Google OAuth Client ID (same as backend)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

#### c) Start Frontend Development Server
```bash
npm run dev
```
Frontend should run on **http://localhost:5173**

---

## Testing the Setup

1. **Backend Health Check:**
   - Open: http://localhost:5000
   - You should see server running message

2. **Frontend:**
   - Open: http://localhost:5173
   - You should see the QuizCraft landing page

3. **Test Login:**
   - Try signing up with email/password
   - Try Google OAuth login

4. **Test Quiz Generation:**
   - Upload a PDF or Word document
   - Generate quiz questions
   - Verify questions appear correctly

---

## Important Files (DO NOT COMMIT)

These files contain sensitive information and are in `.gitignore`:

- `backend/.env` - Backend environment variables
- `frontend/.env` - Frontend environment variables  
- `backend/service-account.json` - Google Cloud credentials
- `backend/uploads/*` - Uploaded files

**Always use `.env.example` files as templates!**

---

## Troubleshooting

### MongoDB Connection Issues
- Verify your connection string is correct
- Whitelist your IP address in MongoDB Atlas
- Check if username/password contain special characters (they need URL encoding)

### Google OAuth Not Working
- Verify `GOOGLE_CLIENT_ID` matches in both frontend and backend `.env`
- Check authorized origins in Google Console include `http://localhost:5173`
- Clear browser cache and cookies

### HuggingFace API Errors
- Check if your token is still valid (tokens can expire)
- Verify you have "Read" access on the token
- The app will fallback to rule-based generation if API fails

### Port Already in Use
- Backend (5000): Change `PORT` in `backend/.env`
- Frontend (5173): Vite will auto-increment to 5174, 5175, etc.

### Email Not Sending
- Verify Mailtrap credentials are correct
- Set `DEV_BYPASS_MAIL=1` to bypass email in development

---

## Git Branches

- **main** - Production-ready code
- **mj_bugfix** - Bug fixes and improvements
- **mj_landingpagedesign** - Landing page and UI updates

---

## Need Help?

If you encounter issues not covered here:
1. Check existing GitHub issues
2. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Your environment (OS, Node version, etc.)

---

## You're All Set!

Your local QuizCraft development environment is ready. Happy coding!
