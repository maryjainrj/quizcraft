// server.js
require('dotenv').config();

// ===== Core / existing OCR deps =====
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse'); // v1 callable
const Tesseract = require('tesseract.js'); // (kept if you use it elsewhere)
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createCanvas, Image } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js'); // legacy build in v4
const vision = require('@google-cloud/vision');

// ===== Auth/DB/GraphQL deps =====
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { graphqlHTTP } = require('express-graphql');

// ---------- Config ----------
const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// OLD flow: verify ID token sent by client
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
// NEW flow: code → tokens; requires secret + 'postmessage'
const googleCodeClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'postmessage'
);

// ---------- CORS & Parsers ----------
app.use(
  cors({
    origin: [FRONTEND_ORIGIN, 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- MongoDB ----------
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((e) => console.error('MongoDB error:', e.message));
} else {
  console.warn('MONGO_URI not set. Auth endpoints will fail without a database.');
}

// ---------- User Model (inline fallback) ----------
let User;
try {
  User = require('./models/User');
} catch {
  const userSchema = new mongoose.Schema(
    {
      username: String,
      name: String,
      email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
      passwordHash: String,
      password: String, // legacy
      provider: { type: String, enum: ['local', 'google'], default: 'local', index: true },
      googleId: String,
    },
    { timestamps: true }
  );
  User = mongoose.models.User || mongoose.model('User', userSchema);
}

// ---------- Google Cloud Vision ----------
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, 'service-account.json'),
});

// ---------- OCR helpers ----------
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function googleVisionOCR(imageBuffer) {
  const imageBase64 = imageBuffer.toString('base64');
  const [result] = await visionClient.documentTextDetection({
    image: { content: imageBase64 },
  });
  return result.fullTextAnnotation ? result.fullTextAnnotation.text : '';
}

async function extractTextFromScannedPDF(pdfBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const pdfDocument = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.5 });
      const canvasFactory = new NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      await page
        .render({
          canvasContext: canvasAndContext.context,
          viewport,
          canvasFactory,
        })
        .promise;

      const { width, height } = canvasAndContext.canvas;
      let ocrText = '';
      if (width < 10 || height < 10) {
        ocrText = '[Skipped: Page image too small for OCR]';
      } else {
        const imageBuffer = canvasAndContext.canvas.toBuffer();
        try {
          ocrText = await googleVisionOCR(imageBuffer);
        } catch (ocrErr) {
          ocrText = '[OCR failed for this page: ' + ocrErr.message + ']';
        }
      }
      fullText += `\n--- Page ${pageNum} ---\n${ocrText}`;
      canvasFactory.destroy(canvasAndContext);
    } catch (pageErr) {
      fullText += `\n--- Page ${pageNum} ---\n[Page rendering failed: ${pageErr.message}]`;
    }
  }
  return fullText;
}

function preprocessImage(imageBuffer) {
  const img = new Image();
  img.src = imageBuffer;
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const avg =
      (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
    const contrast = 1.5;
    const newVal = Math.min(255, Math.max(0, contrast * (avg - 128) + 128));
    imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = newVal;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer();
}

const performOCR = async (imageBuffer) => {
  try {
    return await googleVisionOCR(imageBuffer);
  } catch (err) {
    return '[OCR failed: ' + err.message + ']';
  }
};

// ---------- Uploads ----------
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/bmp',
      'image/webp',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Invalid file type. Only PDF and images are allowed.'));
  },
});

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ---------- OCR Routes ----------
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    let extractedText = '';

    console.log(`Processing file: ${req.file.originalname}`);

    if (fileType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      try {
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
        if (!extractedText.trim()) {
          extractedText = await extractTextFromScannedPDF(dataBuffer);
          if (!extractedText.trim())
            extractedText = 'No text found in scanned PDF (OCR).';
        }
      } catch (error) {
        console.error('PDF text extraction failed:', error);
        extractedText = 'Failed to extract text from PDF.';
      }
    } else {
      const imageBuffer = fs.readFileSync(filePath);
      extractedText = await performOCR(imageBuffer);
    }

    fs.unlinkSync(filePath);
    res.json({
      success: true,
      text: extractedText || 'No text found in the file.',
      filename: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error) {
    console.error('Error processing file:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res
      .status(500)
      .json({ error: 'Failed to process file', message: error.message });
  }
});

// ---------- Generate Quiz ----------
const { generateQuiz: generateQuizFromModule } = require('./quizGenerator');
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { text, settings } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
    const questions = await generateQuizFromModule(text, settings);
    res.json({ questions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Auth helpers ----------
const signToken = (u) =>
  jwt.sign({ id: u._id, email: u.email }, JWT_SECRET, { expiresIn: '7d' });

// ---------- Local Auth (REGISTER with email normalization) ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email & password required' });
    }

    // Normalize/sanitize email (fixes trailing comma/semicolon, mixed case, spaces)
    const cleanEmail = String(email)
      .trim()
      .toLowerCase()
      .replace(/[,;]+$/g, '');

    const exists = await User.findOne({ email: cleanEmail });
    if (exists) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email: cleanEmail,
      passwordHash,          // new field
      provider: 'local',
    });

    return res.json({
      token: signToken(user),
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error('register error:', e.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Local Auth (LOGIN: email OR username) ----------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body || {};
    const id = String(identifier || email || username || '').trim();
    if (!id || !password) {
      return res.status(400).json({ message: 'Email/username and password required' });
    }

    // Build query: if looks like email, normalize; else use username/legacy name
    const query = { provider: 'local' };
    if (id.includes('@')) {
      query.email = id.toLowerCase().replace(/[,;]+$/g, '');
    } else {
      query.$or = [{ username: id }, { name: id }]; // supports legacy "name"
    }

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Compare against new or legacy hash field (must be bcrypt: $2*)
    const hash = user.passwordHash || user.password || '';
    if (!hash || !hash.startsWith('$2')) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(String(password || ''), hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    return res.json({
      token: signToken(user),
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error('login error:', e.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Google Auth: OLD (ID token sent by client) ----------
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential)
      return res.status(400).json({ message: 'Missing Google credential' });
    if (!GOOGLE_CLIENT_ID)
      return res
        .status(500)
        .json({ message: 'Server missing GOOGLE_CLIENT_ID' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ message: 'Invalid Google token' });
    if (payload.aud !== GOOGLE_CLIENT_ID)
      return res.status(401).json({ message: 'Google token audience mismatch' });

    const { sub: googleId, email, name } = payload;
    if (!email) return res.status(400).json({ message: 'Google did not provide an email' });

    let user = await User.findOne({ email });
    if (!user)
      user = await User.create({
        email,
        username: name,
        provider: 'google',
        googleId,
      });

    res.json({
      token: signToken(user),
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error('Google auth error:', e?.message || e);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

// ---------- Google Auth: NEW (Authorization Code Flow with postmessage) ----------
app.post('/api/auth/google/code', async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      step: 'env',
      message: 'Server missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET',
    });
  }

  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ step: 'client', message: 'Missing authorization code' });
    }

    // 1) Exchange code → tokens
    let tokens;
    try {
      const out = await googleCodeClient.getToken(code);
      tokens = out.tokens; // { id_token, access_token, ... }
      if (!tokens?.id_token) throw new Error('No id_token returned from Google');
    } catch (err) {
      console.error('[Google getToken] error:', err?.response?.data || err.message || err);
      return res.status(401).json({
        step: 'exchange',
        message: 'Code exchange failed (invalid_grant or client mismatch).',
        hint:
          'Use SAME client id/secret as frontend, keep OAuth2Client(...,"postmessage"), click once, and sync system time.',
      });
    }

    // 2) Verify id_token
    let payload;
    try {
      const ticket = await googleCodeClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
      if (!payload?.email) throw new Error('No email in Google profile');
    } catch (err) {
      console.error('[verifyIdToken] error:', err?.response?.data || err.message || err);
      return res.status(401).json({ step: 'verify', message: 'ID token verification failed' });
    }

    // 3) Upsert user
    let userDoc;
    try {
      userDoc = await User.findOne({ email: payload.email });
      if (!userDoc) {
        userDoc = await User.create({
          email: payload.email,
          username: payload.name,
          provider: 'google',
          googleId: payload.sub,
        });
      }
    } catch (dbErr) {
      console.error('[DB upsert] error:', dbErr?.message || dbErr);
      const tmp = jwt.sign(
        { email: payload.email, sub: payload.sub },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      return res.status(200).json({
        token: tmp,
        user: { email: payload.email, username: payload.name },
        note: 'DB upsert failed; token issued without persistence. Check MONGO_URI/connection.',
      });
    }

    // 4) Issue app token
    const token = jwt.sign(
      { id: userDoc._id, email: userDoc.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      token,
      user: { id: userDoc._id, email: userDoc.email, username: userDoc.username },
    });
  } catch (err) {
    console.error('[google/code] unexpected error:', err?.response?.data || err.message || err);
    return res.status(500).json({ step: 'unknown', message: 'Unexpected server error' });
  }
});

// ---------- OPTIONAL: GraphQL ----------
try {
  const schema = require('./graphql/schema');
  const questionResolvers = require('./graphql/resolvers');

  let mergedResolvers = { ...questionResolvers };
  try {
    const authResolvers = require('./graphql/authResolvers');
    mergedResolvers = { ...mergedResolvers, ...authResolvers };
    console.log('Auth resolvers loaded and merged.');
  } catch {
    console.log('Auth resolvers not found. Using question resolvers only.');
  }

  app.use(
    '/graphql',
    graphqlHTTP((req) => ({
      schema,
      rootValue: mergedResolvers,
      graphiql: true,
      context: { req },
    }))
  );

  console.log('GraphQL mounted at /graphql');
} catch (e) {
  console.log('GraphQL files not found or failed to load. Skipping /graphql mount.');
}

// ---------- Error handling ----------
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
  }
  res.status(500).json({ error: error.message || 'Server error' });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`OCR + Auth Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(
    'ENV sanity → CID:',
    !!process.env.GOOGLE_CLIENT_ID,
    'CSEC:',
    !!process.env.GOOGLE_CLIENT_SECRET,
    'FRONT:',
    FRONTEND_ORIGIN
  );
});

module.exports = app;
