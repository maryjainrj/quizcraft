# QuizCraft Deployment Guide

## Overview
- **Frontend**: Vercel (React + Vite)
- **Backend**: Render (Node.js/Express)
- **Database**: MongoDB Atlas (already configured)
- **File Storage**: Render persistent disk for uploads

---

##  Deployment Plan

### Phase 1: Backend Preparation (Render)
- [ ] Create `render.yaml` for automated deployment
- [ ] Update CORS to allow Vercel production URL
- [ ] Add production environment variables
- [ ] Configure persistent disk for uploads
- [ ] Test health check endpoint
- [ ] Add start script for production

### Phase 2: Frontend Preparation (Vercel)
- [ ] Create `vercel.json` for build configuration
- [ ] Update API base URL to use environment variables
- [ ] Configure production build settings
- [ ] Test production build locally
- [ ] Add redirect rules for SPA

### Phase 3: Environment & Secrets
- [ ] Set up MongoDB Atlas (already done)
- [ ] Configure Hugging Face API key
- [ ] Set up Google Cloud Vision credentials
- [ ] Configure SMTP for password reset emails
- [ ] Document all required environment variables

### Phase 4: Deploy & Test
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel
- [ ] Test end-to-end functionality
- [ ] Monitor logs and performance
- [ ] Set up custom domain (optional)

---

##  Backend Deployment (Render)

### Required Files

#### 1. `render.yaml` (Blueprint)
```yaml
services:
  - type: web
    name: quizcraft-backend
    env: node
    region: oregon
    plan: free
    buildCommand: cd backend && npm install
    startCommand: cd backend && node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: MONGO_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: HUGGINGFACE_API_KEY
        sync: false
      - key: GOOGLE_APPLICATION_CREDENTIALS
        value: ./service-account.json
      - key: FRONTEND_ORIGIN
        value: https://your-app.vercel.app
      - key: SMTP_HOST
        sync: false
      - key: SMTP_PORT
        value: 2525
      - key: SMTP_USER
        sync: false
      - key: SMTP_PASS
        sync: false
      - key: MAIL_FROM
        value: QuizCraft <no-reply@quizcraft.app>
      - key: HF_CHAT_MODEL
        value: mistralai/Mistral-7B-Instruct-v0.2
    disk:
      name: uploads
      mountPath: /opt/render/project/src/backend/uploads
      sizeGB: 1
```

#### 2. Update `backend/server.js` CORS
```javascript
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: [
      FRONTEND_ORIGIN,
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
```

#### 3. Backend Environment Variables (.env.example)
```
# Server
NODE_ENV=production
PORT=10000

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/quizcraft

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AI & OCR
HUGGINGFACE_API_KEY=hf_your_api_key_here
HF_CHAT_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# Google Cloud Vision (JSON file path or inline JSON)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Email (Mailtrap or production SMTP)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
MAIL_FROM=QuizCraft <no-reply@quizcraft.app>

# Frontend URL
FRONTEND_ORIGIN=https://your-app.vercel.app
```

### Render Setup Steps

1. **Create Render Account**: https://render.com
2. **New Web Service**:
   - Connect your GitHub repository
   - Select branch: `maryjain_sprint_4.1` or `main`
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `node server.js`
3. **Add Environment Variables** (from .env.example above)
4. **Add Persistent Disk**:
   - Name: `uploads`
   - Mount path: `/opt/render/project/src/backend/uploads`
   - Size: 1 GB (Free tier)
5. **Google Vision Credentials**:
   - Option A: Upload `service-account.json` via Render dashboard
   - Option B: Set as environment variable (JSON string)
6. **Deploy!**

### Health Check
Render will ping: `GET /api/health` (already implemented)

---

##  Frontend Deployment (Vercel)

### Required Files

#### 1. `vercel.json`
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_API_BASE": "@vite_api_base"
  }
}
```

#### 2. Update `frontend/.env.production`
```
VITE_API_BASE=https://quizcraft-backend.onrender.com
```

#### 3. Update `frontend/.env.example`
```
# Backend API URL
VITE_API_BASE=http://localhost:5000
```

#### 4. Frontend Environment Variables
- `VITE_API_BASE`: Your Render backend URL

### Vercel Setup Steps

1. **Create Vercel Account**: https://vercel.com
2. **Import Project**:
   - Connect GitHub repository
   - Select branch: `maryjain_sprint_4.1` or `main`
   - Framework preset: Vite
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
3. **Add Environment Variable**:
   - Key: `VITE_API_BASE`
   - Value: `https://quizcraft-backend.onrender.com` (your Render URL)
4. **Deploy!**

### Custom Domain (Optional)
- Add your domain in Vercel dashboard
- Update `FRONTEND_ORIGIN` in Render environment variables

---

##  Security Checklist

- [ ] Strong JWT_SECRET (generate with: `openssl rand -base64 32`)
- [ ] MongoDB Atlas IP whitelist (add `0.0.0.0/0` for Render)
- [ ] Google Cloud Vision API key restrictions
- [ ] Hugging Face API rate limits configured
- [ ] CORS restricted to production domains only
- [ ] HTTPS enforced (automatic on Vercel & Render)
- [ ] Sensitive files in .gitignore (`service-account.json`, `.env`)

---

##  Testing Deployment

### Local Production Build Test

**Backend:**
```bash
cd backend
NODE_ENV=production PORT=5000 node server.js
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

### Post-Deployment Tests
1. **Health Check**: `curl https://quizcraft-backend.onrender.com/api/health`
2. **Auth Flow**: Login/Signup
3. **File Upload**: OCR PDF/image
4. **Quiz Generation**: Text-based with equations
5. **Quiz CRUD**: Create, edit, delete quiz
6. **Export/Share**: PDF export, share link

---

##  Monitoring

### Render
- Dashboard → Logs (real-time)
- Metrics: CPU, Memory, Response times
- Alerts: Email notifications on crash

### Vercel
- Dashboard → Deployments (build logs)
- Analytics: Page views, performance
- Function logs (if using serverless)

---

##  Deployment Commands

### Initial Deploy (Automatic via Git)
```bash
git push origin maryjain_sprint_4.1
# Vercel & Render will auto-deploy on push
```

### Manual Redeploy
- **Render**: Dashboard → Manual Deploy
- **Vercel**: Dashboard → Redeploy

### Rollback
- **Render**: Deployments → Select previous → Redeploy
- **Vercel**: Deployments → Select previous → Promote to Production

---

## Tips & Best Practices

1. **Free Tier Limitations**:
   - Render: Service spins down after 15 min inactivity (cold start ~30s)
   - Vercel: 100 GB bandwidth/month
   - MongoDB Atlas: 512 MB storage

2. **Keep Services Warm** (optional):
   - Use UptimeRobot or similar to ping backend every 10 minutes
   - Prevents cold starts

3. **Environment-specific Config**:
   - Use `.env.production` for production-only settings
   - Never commit real credentials to Git

4. **Database Backups**:
   - MongoDB Atlas auto-backups on paid tiers
   - Export important data periodically

5. **API Rate Limits**:
   - Hugging Face: 1000 requests/day on free tier
   - Google Vision: 1000 requests/month free

---

##  Common Issues & Solutions

### Issue: CORS errors in production
**Solution**: Update `FRONTEND_ORIGIN` in Render to match Vercel URL exactly

### Issue: 502 Bad Gateway on Render
**Solution**: Check backend logs; ensure MongoDB connection string is correct

### Issue: Build fails on Vercel
**Solution**: Check Node version; Vercel uses Node 18+ by default

### Issue: Google Vision fails
**Solution**: Upload `service-account.json` to Render persistent disk or use inline JSON

### Issue: Uploads disappear after redeploy
**Solution**: Ensure persistent disk is mounted correctly in Render

---

##  Support Resources

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas**: https://www.mongodb.com/docs/atlas/
- **Hugging Face**: https://huggingface.co/docs/api-inference

---

## Next Steps

1. Complete backend preparation (render.yaml, CORS updates)
2. Complete frontend preparation (vercel.json, API URL)
3. Set up all environment variables
4. Deploy backend to Render
5. Deploy frontend to Vercel
6. Run end-to-end tests
7. Monitor and optimize

**Ready to start?** Let me know and I'll help you create the necessary config files!
