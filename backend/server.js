require('dotenv').config();

// OCR-capable Express server
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse'); // Direct require (v1 is callable)
const Tesseract = require('tesseract.js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createCanvas, Image } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js'); // Legacy build in v4
const vision = require('@google-cloud/vision');

// Initialize Google Cloud Vision with service account
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, 'service-account.json')
});

// NodeCanvasFactory for pdfjs-dist in Node.js (from working model)
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

// Google Cloud Vision OCR (from working model, using initialized client)
async function googleVisionOCR(imageBuffer) {
  const imageBase64 = imageBuffer.toString('base64');
  const [result] = await visionClient.documentTextDetection({ image: { content: imageBase64 } });
  return result.fullTextAnnotation ? result.fullTextAnnotation.text : '';
}

// Helper to convert PDF pages to images and run OCR (from working model)
async function extractTextFromScannedPDF(pdfBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const pdfDocument = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.5 }); // Reduced scale for stability
      const canvasFactory = new NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      await page.render({
        canvasContext: canvasAndContext.context,
        viewport: viewport,
        canvasFactory: canvasFactory
      }).promise;

      // Skip very small images (likely blank or invalid pages)
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

// Preprocess image: convert to grayscale and enhance contrast (from working model)
function preprocessImage(imageBuffer) {
  const img = new Image();
  img.src = imageBuffer;
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  // Convert to grayscale
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
    // Enhance contrast by stretching values
    const contrast = 1.5;
    const newVal = Math.min(255, Math.max(0, contrast * (avg - 128) + 128));
    imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = newVal;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer();
}

// Perform OCR on image buffer with Google Vision (from working model)
const performOCR = async (imageBuffer) => {
  try {
    return await googleVisionOCR(imageBuffer);
  } catch (err) {
    return '[OCR failed: ' + err.message + ']';
  }
};

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
});

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Upload and process file endpoint (from working model)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    let extractedText = '';

    console.log(`Processing file: ${req.file.originalname}`);

    if (fileType === 'application/pdf') {
      // Process PDF
      const dataBuffer = fs.readFileSync(filePath);
      try {
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
        // If no text found, try OCR on scanned pages
        if (!extractedText.trim()) {
          extractedText = await extractTextFromScannedPDF(dataBuffer);
          if (!extractedText.trim()) {
            extractedText = 'No text found in scanned PDF (OCR).';
          }
        }
      } catch (error) {
        console.error('PDF text extraction failed:', error);
        extractedText = 'Failed to extract text from PDF.';
      }
    } else {
      // Process Image
      const imageBuffer = fs.readFileSync(filePath);
      extractedText = await performOCR(imageBuffer);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      text: extractedText || 'No text found in the file.',
      filename: req.file.originalname,
      fileSize: req.file.size
    });

  } catch (error) {
    console.error('Error processing file:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to process file', 
      message: error.message 
    });
  }
});

// NEW: Generate Quiz Endpoint
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

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`OCR Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});

module.exports = app;