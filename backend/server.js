// server.js - Main server file for OCR and Auth
require("dotenv").config();
// ===== Core / existing OCR deps =====
const express = require("express");
const app = express();
// Root route for friendly message
app.get('/', (req, res) => {
  res.send('QuizCraft API is running!');
});
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth"); // For Word documents
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { createCanvas, Image, loadImage } = require("canvas");
let sharp;
try {
  sharp = require('sharp');
  console.log(' sharp loaded for image preprocessing');
} catch (e) {
  console.warn(' sharp not installed — image preprocessing will use canvas fallback');
  sharp = null;
}
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const vision = require("@google-cloud/vision");
const configRoutes = require('./routes/config');
const authRoutes = require('./routes/authRoutes');

// ===== Auth/DB/GraphQL deps =====
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { graphqlHTTP } = require("express-graphql");

// ===== Added for password reset (Mailtrap) =====
const nodemailer = require("nodemailer");
const crypto = require("crypto");

//  NEW: question set REST routes
const questionSetRoutes = require("./routes/questionSetRoutes");

// ---------- Config ----------
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// When set to '1', suppress Vision logs and only print handwritten (Tesseract) text
const LOG_HANDWRITTEN_ONLY = String(process.env.LOG_HANDWRITTEN_ONLY || "0") === "1";

// Tesseract performance/config
const TESSERACT_TIMEOUT_MS = Number(process.env.TESSERACT_TIMEOUT_MS || 10000); // ms
const TESSERACT_MAX_DIM = Number(process.env.TESSERACT_MAX_DIM || 1200); // max width/height for images passed to tesseract
const TESSERACT_PSM = Number(process.env.TESSERACT_PSM || 3); // page segmentation mode for tesseract
const PDF_RENDER_SCALE = Number(process.env.PDF_RENDER_SCALE || 2.0); // default render scale (reduce if images are huge)

// Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const googleCodeClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "postmessage"
);

// ---------- CORS & Parsers ----------
// Allow multiple origins for development and production

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN?.replace(/\/?$/, ''), // remove trailing slash if any
  "http://localhost:5173",
  "http://127.0.0.1:5173"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      // Remove trailing slash for comparison
      const cleanOrigin = origin.replace(/\/?$/, '');
      if (allowedOrigins.includes(cleanOrigin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);

//  SMALL REQUEST LOGGER (helps you see if /api/questionsets/mine hits this server)
app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

//  MOUNT QUESTION SET ROUTES (THIS IS WHAT /api/questionsets/mine USES)
app.use("/api/questionsets", questionSetRoutes);

// ---------- MongoDB ----------
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((e) => console.error("MongoDB error:", e.message));
} else {
  console.warn("MONGO_URI not set. Auth endpoints will fail without a database.");
}

// ---------- User Model (inline fallback) ----------
let User;
try {
  User = require("./models/User");
} catch {
  const userSchema = new mongoose.Schema(
    {
      username: String,
      name: String,
      email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true,
      },
      passwordHash: String,
      // legacy backup
      password: String,
      provider: {
        type: String,
        enum: ["local", "google"],
        default: "local",
        index: true,
      },
      googleId: String,
      // minimal OTP fields if model missing (safe fallback)
      passwordOtpHash: { type: String, select: false },
      passwordOtpExpires: { type: Date },
      passwordOtpAttempts: { type: Number, default: 0, select: false },
    },
    { timestamps: true }
  );
  User = mongoose.models.User || mongoose.model("User", userSchema);
}

// ---------- Google Cloud Vision ----------
let visionClient = null;
try {
  const serviceAccountPath = path.join(__dirname, "service-account.json");
  console.log(" Looking for service account at:", serviceAccountPath);
  console.log(" File exists:", fs.existsSync(serviceAccountPath));
  
  if (fs.existsSync(serviceAccountPath)) {
    visionClient = new vision.ImageAnnotatorClient({
      keyFilename: serviceAccountPath,
    });
    console.log(" Google Vision Client initialized with service account");
  } else {
    // Try using GOOGLE_APPLICATION_CREDENTIALS environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      visionClient = new vision.ImageAnnotatorClient();
      console.log(" Google Vision Client initialized with GOOGLE_APPLICATION_CREDENTIALS env var");
    } else {
      console.warn("  service-account.json not found and GOOGLE_APPLICATION_CREDENTIALS not set");
      console.warn("  Scanned document OCR will not work");
    }
  }
} catch (err) {
  console.error(" Failed to initialize Vision API client:", err.message);
  visionClient = null;
}

// ---------- OCR helpers ----------
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
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
  if (!visionClient) {
    throw new Error("Vision API client not initialized. Check service-account.json or GOOGLE_APPLICATION_CREDENTIALS.");
  }

  try {
    const imageBase64 = imageBuffer.toString("base64");
    const [result] = await visionClient.documentTextDetection({
      image: { content: imageBase64 },
    });

    if (!result) {
      console.warn("  No result from Vision API");
      return "";
    }

    let text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";
    // Only log Vision results when not in handwritten-only logging mode
    if (!LOG_HANDWRITTEN_ONLY) {
      const preview = String(text || '').slice(0, 300).replace(/\n/g, ' ');
      console.log(" Vision OCR returned", (text || '').length, "chars");
      if (preview) console.log(" Preview:", preview.slice(0, 100) + "...");
    }

    return text || "";
  } catch (err) {
    console.error(" Vision API OCR error:", err.message);
    throw err;
  }
}

async function extractTextFromScannedPDF(pdfBuffer) {
  if (!visionClient) {
    console.warn("  Vision API client not available for scanned PDF");
    return "[Scanned PDF OCR skipped: Vision API not configured]";
  }
  // Ensure pdfjs gets a Uint8Array (it rejects Node Buffer)
  const uint8Buffer =
    pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);

  const loadingTask = pdfjsLib.getDocument({ data: uint8Buffer });
  const pdfDocument = await loadingTask.promise;
  
  console.log(` PDF loaded successfully. Pages: ${pdfDocument.numPages}`);
  
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    try {
      console.log(`\n Processing page ${pageNum}/${pdfDocument.numPages}...`);
      
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      
      console.log(` Page ${pageNum} viewport: ${Math.round(viewport.width)}x${Math.round(viewport.height)}`);
      
      const canvasFactory = new NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(
        viewport.width,
        viewport.height
      );

      await page
        .render({
          canvasContext: canvasAndContext.context,
          viewport: viewport,
          canvasFactory: canvasFactory,
        })
        .promise;

      const { width, height } = canvasAndContext.canvas;
      let ocrText = "";

      if (width < 10 || height < 10) {
        console.warn(`  Page ${pageNum} too small: ${width}x${height}`);
        ocrText = "[Skipped: Page image too small for OCR]";
      } else {
        const imageBuffer = canvasAndContext.canvas.toBuffer();
        console.log(`  Canvas rendered, image size: ${Math.round(imageBuffer.length / 1024)}KB`);

        // Preprocess the rendered image to improve OCR accuracy (grayscale/normalize/threshold)
        let preparedBuffer = imageBuffer;
        try {
          preparedBuffer = await preprocessImage(imageBuffer);
        } catch (preErr) {
          console.warn('Image preprocessing failed, using raw canvas buffer:', preErr.message || preErr);
          preparedBuffer = imageBuffer;
        }

        try {
          //  STEP 1: Try Google Vision first
          console.log(` Running Vision API OCR on page ${pageNum}...`);
          ocrText = await googleVisionOCR(preparedBuffer);
          console.log(` Vision OCR returned ${ocrText.length} characters`);

          //  STEP 2: If Vision returns empty/short text, use Tesseract
          // This is CRITICAL for handwritten notes!
          if (!ocrText.trim() || ocrText.length < 20) {
            console.log(`  Vision OCR empty/short (${ocrText.length} chars), trying Tesseract for handwriting...`);
            try {
              const resized = await resizeImageBufferIfNeeded(imageBuffer);
              const { text: tessText, durationMs, timedOut } = await runTesseractWithTimeout(resized);
              ocrText = tessText || "[No text detected on this page]";
              console.log(` Tesseract extracted ${ocrText.length} characters (took ${durationMs}ms${timedOut ? ', TIMED OUT' : ''})`);
              try {
                console.log(`\n[HANDWRITTEN] Page ${pageNum} content:\n${ocrText}\n`);
              } catch (e) {
                console.log(`[HANDWRITTEN] Page ${pageNum} (error printing content):`, e.message);
              }
            } catch (tErr) {
              console.error(` Tesseract failed on page ${pageNum}:`, tErr.message || tErr);
              ocrText = `[Tesseract failed: ${tErr && tErr.message ? tErr.message : 'unknown'}]`;
            }
          }
        } catch (ocrErr) {
          console.error(` OCR failed for page ${pageNum}:`, ocrErr.message);
          ocrText = "[OCR failed for this page: " + ocrErr.message + "]";
        }
      }

      fullText += `\n--- Page ${pageNum} ---\n${ocrText}`;
      canvasFactory.destroy(canvasAndContext);
      
      console.log(` Page ${pageNum}/${pdfDocument.numPages} completed`);
    } catch (pageErr) {
      console.error(` Page rendering failed for page ${pageNum}:`, pageErr.message);
      fullText += `\n--- Page ${pageNum} ---\n[Page rendering failed: ${pageErr.message}]`;
    }
  }

  return fullText;
}

function preprocessImage(imageBuffer) {
  // Use `sharp` when available for better preprocessing (grayscale, normalize, sharpen, threshold)
  if (sharp) {
    return sharp(imageBuffer)
      .greyscale()
      .normalize()
      .sharpen()
      .threshold(160)
      .toBuffer()
      .catch((e) => {
        console.warn('sharp preprocessing failed, falling back to canvas:', e.message);
        // fallback to canvas below
        const img = new Image();
        img.src = imageBuffer;
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return canvas.toBuffer();
      });
  }

  // Canvas fallback (less advanced): simple contrast boost + return buffer
  const img = new Image();
  img.src = imageBuffer;
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
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

async function resizeImageBufferIfNeeded(imageBuffer, maxDim = TESSERACT_MAX_DIM) {
  try {
    const img = await loadImage(imageBuffer);
    const w = img.width;
    const h = img.height;
    const largest = Math.max(w, h);
    if (largest <= maxDim) return imageBuffer;

    const scale = maxDim / largest;
    const nw = Math.round(w * scale);
    const nh = Math.round(h * scale);
    const canvas = createCanvas(nw, nh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, nw, nh);
    // return as JPEG to reduce size and speed up Tesseract
    return canvas.toBuffer('image/jpeg', { quality: 0.8 });
  } catch (e) {
    console.warn('resizeImageBufferIfNeeded failed, returning original buffer:', e.message);
    return imageBuffer;
  }
}

async function runTesseractWithTimeout(imageBuffer, timeoutMs = TESSERACT_TIMEOUT_MS) {
  const Tesseract = require('tesseract.js');
  const start = Date.now();

  const recognizePromise = (async () => {
    const result = await Tesseract.recognize(imageBuffer, 'eng', { tessedit_pageseg_mode: TESSERACT_PSM });
    return result && result.data && result.data.text ? result.data.text : '';
  })();

  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      // We cannot reliably terminate the internal worker when using the high-level API,
      // so just reject. This prevents hanging the request but may leave background work.
      reject(new Error('Tesseract recognition timed out'));
    }, timeoutMs);
  });

  try {
    const text = await Promise.race([recognizePromise, timeoutPromise]);
    const duration = Date.now() - start;
    return { text: text || '', durationMs: duration, timedOut: false };
  } catch (err) {
    const duration = Date.now() - start;
    return { text: '', durationMs: duration, timedOut: true };
  }
}

const performOCR = async (imageBuffer) => {
  try {
    let text = "";
    let usedHandwriting = false;
    let durationMs = 0;
    let timedOut = false;

    if (visionClient) {
      try {
        text = await googleVisionOCR(imageBuffer);
      } catch (e) {
        console.warn('Vision OCR failed for image:', e.message);
        text = "";
      }
    }

    if (!text.trim() || text.length < 20) {
      usedHandwriting = true;
      try {
        const resized = await resizeImageBufferIfNeeded(imageBuffer);
        let prepped = resized;
        try {
          prepped = await preprocessImage(resized);
        } catch (e) {
          // ignore and use resized
        }
        const result = await runTesseractWithTimeout(prepped);
        durationMs = result.durationMs || 0;
        timedOut = !!result.timedOut;
        text = result.text || "";
        console.log(` Tesseract (image) extracted ${String(text).length} characters (took ${durationMs}ms${timedOut ? ', TIMED OUT' : ''})`);
        try {
          console.log(`\n[HANDWRITTEN] Image content:\n${text}\n`);
        } catch (e) {
          console.log('[HANDWRITTEN] Image (error printing):', e.message);
        }
      } catch (e) {
        console.error(' Tesseract image OCR failed:', e.message || e);
        text = "";
      }
    }

    return { text: text || "", usedHandwriting, durationMs, timedOut };
  } catch (err) {
    console.error(" performOCR error:", err.message || err);
    throw err;
  }
};

// ---------- Uploads ----------
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.ms-powerpoint", // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/bmp",
      "image/webp",
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Invalid file type. Only PDF, Word, PowerPoint, and images are allowed."));
  },
});

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// ---------- OCR Routes ----------
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    let extractedText = "";
    let handwritingMeta = null;

    console.log(`\n Processing file: ${req.file.originalname}, type: ${fileType}`);

    // Handle PDF files
    if (fileType === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      try {
        console.log(" Attempting pdf-parse text extraction...");
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
        console.log(` pdf-parse extracted ${extractedText.length} characters`);
        
        if (!extractedText.trim()) {
          console.log("  No text in pdf-parse, attempting OCR on scanned document...");
          const uint8Buffer = Buffer.isBuffer(dataBuffer)
            ? new Uint8Array(dataBuffer)
            : dataBuffer instanceof Uint8Array
            ? dataBuffer
            : new Uint8Array(dataBuffer);
          extractedText = await extractTextFromScannedPDF(uint8Buffer);
          if (!extractedText.trim())
            extractedText = "No text found in scanned PDF (OCR).";
        }
      } catch (error) {
        console.error(" PDF text extraction failed:", error.message);
        console.log(" Attempting OCR fallback for scanned PDF...");
        try {
          const uint8Buffer = Buffer.isBuffer(dataBuffer)
            ? new Uint8Array(dataBuffer)
            : dataBuffer instanceof Uint8Array
            ? dataBuffer
            : new Uint8Array(dataBuffer);
          extractedText = await extractTextFromScannedPDF(uint8Buffer);
          if (!extractedText.trim())
            extractedText = "Failed to extract text from PDF.";
        } catch (ocrError) {
          console.error(" OCR fallback also failed:", ocrError.message);
          extractedText = "Failed to extract text from PDF: " + error.message;
        }
      }
    } 
    // Handle Word documents (.doc, .docx)
    else if (fileType === "application/msword" || 
             fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      try {
        console.log("Extracting text from Word document...");
        const result = await mammoth.extractRawText({ path: filePath });
        
        // Split text into pages (approximate 500 words per page)
        const words = result.value.split(/\s+/);
        const wordsPerPage = 500;
        let pageNumber = 1;
        let pageTexts = [];
        
        for (let i = 0; i < words.length; i += wordsPerPage) {
          const pageWords = words.slice(i, i + wordsPerPage);
          const pageText = pageWords.join(' ');
          if (pageText.trim()) {
            pageTexts.push(`\n--- Page ${pageNumber} ---\n${pageText}`);
            pageNumber++;
          }
        }
        
        extractedText = pageTexts.join('\n');
        console.log(`Word extraction successful. Text length: ${extractedText.length} characters`);
        console.log(`Estimated pages: ${pageNumber - 1}`);
        console.log(`First 200 chars: ${extractedText.substring(0, 200)}`);
        
        if (!extractedText.trim()) {
          extractedText = "No text found in Word document.";
        }
      } catch (error) {
        console.error("Word document extraction failed:", error);
        extractedText = "Failed to extract text from Word document: " + error.message;
      }
    }
    // Handle PowerPoint files (.ppt, .pptx) - For now, return message
    else if (fileType === "application/vnd.ms-powerpoint" || 
             fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      extractedText = "PowerPoint text extraction is not yet fully implemented. Please convert to PDF or upload images of slides.";
    }
    // Handle images
    else {
      console.log("  Processing image file with OCR...");
      const imageBuffer = fs.readFileSync(filePath);
      try {
        const ocrResult = await performOCR(imageBuffer);
        if (ocrResult && typeof ocrResult === 'object') {
          extractedText = ocrResult.text || "";
          handwritingMeta = {
            usedHandwriting: !!ocrResult.usedHandwriting,
            durationMs: Number(ocrResult.durationMs || 0),
            timedOut: !!ocrResult.timedOut,
          };
        } else {
          extractedText = String(ocrResult || "");
        }
        console.log(` Image OCR extracted ${String(extractedText).length} characters`);
      } catch (err) {
        console.error(" Image OCR failed:", err.message || err);
        extractedText = "[Image OCR failed: " + (err && err.message ? err.message : String(err)) + "]";
      }
    }

    fs.unlinkSync(filePath);
    const responseBody = {
      success: true,
      text: extractedText || "No text found in the file.",
      filename: req.file.originalname,
      fileSize: req.file.size,
    };
    if (handwritingMeta) responseBody.handwriting = handwritingMeta;
    res.json(responseBody);
  } catch (error) {
    console.error("Error processing file:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res
      .status(500)
      .json({ error: "Failed to process file", message: error.message });
  }
});

// ---------- Generate Quiz ----------
const { generateQuiz: generateQuizFromModule } = require("./quizGenerator");

app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { text, settings } = req.body;
    if (!text?.trim())
      return res.status(400).json({ error: "No text provided" });
    const questions = await generateQuizFromModule(text, settings);
    res.json({ questions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Auth helpers ----------
const signToken = (u) =>
  jwt.sign({ id: u._id, email: u.email }, JWT_SECRET, {
    expiresIn: "7d",
  });

// ---------- Local Auth (REGISTER) ----------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const cleanEmail = String(email).trim().toLowerCase().replace(/[,;]+$/g, "");
    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ email: cleanEmail });
    if (exists) return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email: cleanEmail,
      passwordHash,
      password: passwordHash, // keep legacy in sync
      provider: "local",
    });

    return res.json({
      token: signToken(user),
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.status(409).json({ message: "Email already in use" });
    }
    console.error("register error:", e?.message || e);
    return res.status(500).json({ message: "Server error" });
  }
});

// ---------- Local Auth (LOGIN: email OR username) ----------
app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body || {};
    const id = String(identifier || email || username || "").trim();
    if (!id || !password) {
      return res
        .status(400)
        .json({ message: "Email/username and password required" });
    }

    const query = { provider: "local" };
    if (id.includes("@")) {
      query.email = id.toLowerCase().replace(/[,;]+$/g, "");
    } else {
      query.$or = [{ username: id }, { name: id }];
    }

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const hash = user.passwordHash || user.password || "";
    if (!hash || !hash.startsWith("$2")) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(String(password || ""), hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    return res.json({
      token: signToken(user),
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error("login error:", e.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ===== Password Reset: Mailer + helpers =====
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 2525), // Mailtrap default
  secure: false, // STARTTLS
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  logger: process.env.MAIL_DEBUG === "1",
  debug: process.env.MAIL_DEBUG === "1",
});

mailer
  .verify()
  .then(() => console.log("[MAILER] SMTP verify: OK"))
  .catch((e) =>
    console.error("[MAILER] SMTP verify FAILED:", e?.message || e)
  );

const sendMail = async (opts) => {
  const forcedTo =
    process.env.MAILTRAP_FORCE_TO && process.env.MAILTRAP_FORCE_TO.trim();
  const to = forcedTo || opts.to;

  const info = await mailer.sendMail({
    from: process.env.MAIL_FROM || "QuizCraft <no-reply@quizcraft.local>",
    ...opts,
    to,
  });

  console.log(
    "[MAILER] sent",
    JSON.stringify({
      to,
      messageId: info?.messageId,
      envelope: info?.envelope,
      accepted: info?.accepted,
      rejected: info?.rejected,
    })
  );

  return info;
};

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const sixDigit = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
const OTP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

// Debug SMTP / test email endpoints (non-production only)
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug/smtp-status", async (req, res) => {
    try {
      await mailer.verify();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/debug/send-test", async (req, res) => {
    try {
      const to =
        req.query.to || process.env.DEBUG_TO || "test@inbox.mailtrap.io";
      const info = await sendMail({
        to,
        subject: "QuizCraft SMTP test",
        text: "This is a Mailtrap test message from QuizCraft.",
      });
      console.log("Mailtrap messageId:", info && info.messageId);
      res.json({ sent: true, messageId: info && info.messageId, to });
    } catch (e) {
      console.error("send-test error:", e.message);
      res.status(500).json({ sent: false, error: e.message });
    }
  });
}

// ---------- Password Reset: request OTP ----------
app.post("/api/auth/request-password-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    // don't reveal if user exists
    if (!user) {
      return res.json({
        message: "If the email exists, an OTP has been sent.",
      });
    }

    // generate + store OTP
    const code = sixDigit();

    // Optional: log OTP in dev only if you explicitly allow it
    if (process.env.DEV_LOG_OTP === "1") {
      console.log("[OTP] generated for", email, "→", code);
    }

    user.passwordOtpHash = sha256(code);
    user.passwordOtpExpires = new Date(Date.now() + OTP_WINDOW_MS);
    user.passwordOtpAttempts = 0;
    await user.save();

    // DEV bypass prints code when mail disabled
    if (process.env.DEV_BYPASS_MAIL === "1") {
      console.log("[DEV_BYPASS_MAIL] OTP for", email, "→", code);
    } else {
      await sendMail({
        to: email,
        subject: "Your QuizCraft password reset code",
        text: `Your OTP is ${code}. It expires in 10 minutes.`,
      });
    }

    return res.json({ message: "OTP sent to your email." });
  } catch (e) {
    console.error(
      "request-password-otp ERROR →",
      e && (e.stack || e.message || e)
    );
    return res.status(500).json({
      message: "Failed to send OTP",
      detail: String(e && (e.message || e)),
    });
  }
});

// ---------- Password Reset: verify OTP & set new password ----------
app.post("/api/auth/reset-password-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    const newPassword = String(req.body?.password || "");

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email, OTP and password are required" });
    }

    // include select:false fields explicitly
    const user = await User.findOne({ email }).select(
      "+passwordOtpHash +passwordOtpAttempts"
    );
    if (!user || !user.passwordOtpHash || !user.passwordOtpExpires) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    // Expired
    if (Date.now() > new Date(user.passwordOtpExpires).getTime()) {
      user.passwordOtpHash = undefined;
      user.passwordOtpExpires = undefined;
      user.passwordOtpAttempts = 0;
      await user.save();
      return res
        .status(400)
        .json({ message: "OTP expired. Request a new one." });
    }

    // Too many attempts
    if (user.passwordOtpAttempts >= OTP_MAX_ATTEMPTS) {
      user.passwordOtpHash = undefined;
      user.passwordOtpExpires = undefined;
      user.passwordOtpAttempts = 0;
      await user.save();
      return res
        .status(429)
        .json({ message: "Too many attempts. Request a new code." });
    }

    const ok = sha256(otp) === user.passwordOtpHash;
    user.passwordOtpAttempts = (user.passwordOtpAttempts || 0) + 1;

    if (!ok) {
      await user.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Hash new password and persist (keep legacy in sync if used)
    const hash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hash;
    user.password = hash;

    // clear OTP data
    user.passwordOtpHash = undefined;
    user.passwordOtpExpires = undefined;
    user.passwordOtpAttempts = 0;

    await user.save();
    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("reset-password-otp:", err);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

// ---------- Google Auth: OLD (ID token sent by client) ----------
app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential)
      return res.status(400).json({ message: "Missing Google credential" });
    if (!GOOGLE_CLIENT_ID)
      return res
        .status(500)
        .json({ message: "Server missing GOOGLE_CLIENT_ID" });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ message: "Invalid Google token" });
    if (payload.aud !== GOOGLE_CLIENT_ID)
      return res
        .status(401)
        .json({ message: "Google token audience mismatch" });

    const { sub: googleId, email, name } = payload;
    if (!email)
      return res
        .status(400)
        .json({ message: "Google did not provide an email" });

    let user = await User.findOne({ email });
    if (!user)
      user = await User.create({
        email,
        username: name,
        provider: "google",
        googleId,
      });

    res.json({
      token: signToken(user),
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (e) {
    console.error("Google auth error:", e?.message || e);
    res.status(401).json({ message: "Invalid Google token" });
  }
});

// ---------- Google Auth (Code Flow) ----------
app.post("/api/auth/google/code", async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      step: "env",
      message: "Server missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET",
    });
  }

  try {
    const { code } = req.body || {};
    if (!code) {
      return res
        .status(400)
        .json({ step: "client", message: "Missing authorization code" });
    }

    let tokens;
    try {
      const out = await googleCodeClient.getToken(code);
      tokens = out.tokens;
      if (!tokens?.id_token)
        throw new Error("No id_token returned from Google");
    } catch (err) {
      console.error(
        "[Google getToken] error:",
        err?.response?.data || err.message || err
      );
      return res.status(401).json({
        step: "exchange",
        message: "Code exchange failed (invalid_grant or client mismatch).",
        hint: "Use SAME client id/secret as frontend, keep OAuth2Client(...,\"postmessage\"), click once, and sync system time.",
      });
    }

    let payload;
    try {
      const ticket = await googleCodeClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
      if (!payload?.email) throw new Error("No email in Google profile");
    } catch (err) {
      console.error(
        "[verifyIdToken] error:",
        err?.response?.data || err.message || err
      );
      return res
        .status(401)
        .json({ step: "verify", message: "ID token verification failed" });
    }

    let userDoc;
    try {
      userDoc = await User.findOne({ email: payload.email });
      if (!userDoc) {
        userDoc = await User.create({
          email: payload.email,
          username: payload.name,
          provider: "google",
          googleId: payload.sub,
        });
      }
    } catch (dbErr) {
      console.error("[DB upsert] error:", dbErr?.message || dbErr);
      const tmp = jwt.sign(
        { email: payload.email, sub: payload.sub },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res.status(200).json({
        token: tmp,
        user: { email: payload.email, username: payload.name },
        note: "DB upsert failed; token issued without persistence. Check MONGO_URI/connection.",
      });
    }

    const token = jwt.sign(
      { id: userDoc._id, email: userDoc.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.json({
      token,
      user: {
        id: userDoc._id,
        email: userDoc.email,
        username: userDoc.username,
      },
    });
  } catch (err) {
    console.error(
      "[google/code] unexpected error:",
      err?.response?.data || err.message || err
    );
    return res
      .status(500)
      .json({ step: "unknown", message: "Unexpected server error" });
  }
});

// ---------- PDF upload for public URL ----------
app.post("/api/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

    const publicUrl = `${
      process.env.BASE_URL || "http://localhost:5000"
    }/uploads/${req.file.filename}`;

    res.json({ url: publicUrl });
  } catch (err) {
    console.error("PDF upload error:", err);
    res.status(500).json({ error: "Failed to upload PDF" });
  }
});

// ---------- Static Uploads ----------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- GraphQL (single mount) ----------
try {
  const schema = require("./graphql/schema");
  const questionResolvers = require("./graphql/resolvers");
  let authResolvers = {};
  let questionSetResolvers = {};

  try {
    authResolvers = require("./graphql/authResolvers");
    console.log("Auth resolvers loaded.");
  } catch {
    console.log("Auth resolvers not found. Skipping.");
  }

  try {
    questionSetResolvers = require("./graphql/questionSetResolvers");
    console.log("QuestionSet resolvers loaded.");
  } catch {
    console.log("QuestionSet resolvers not found. Skipping.");
  }

  const mergedResolvers = {
    ...questionResolvers,
    ...authResolvers,
    ...questionSetResolvers,
  };

  app.use(
    "/graphql",
    graphqlHTTP((req) => ({
      schema,
      rootValue: mergedResolvers,
      graphiql: true,
      context: { req },
    }))
  );

  console.log("GraphQL endpoint: http://localhost:5000/graphql");
} catch (e) {
  console.error("Failed to mount GraphQL:", e.message);
}

// ---------- Error handling ----------
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ error: "File too large. Maximum size is 10MB." });
  }
  res.status(500).json({ error: error.message || "Server error" });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`OCR + Auth Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(
    "ENV sanity → CID:",
    !!process.env.GOOGLE_CLIENT_ID,
    "CSEC:",
    !!process.env.GOOGLE_CLIENT_SECRET,
    "FRONT:",
    FRONTEND_ORIGIN
  );
});

module.exports = app;
