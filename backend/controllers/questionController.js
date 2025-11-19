// controllers/questionController.js
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { createCanvas, Image } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const vision = require('@google-cloud/vision');

// Initialize Vision Client with service account
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, '../service-account.json'), // Adjust path if needed (place service-account.json in backend root)
});

// Google Cloud Vision OCR
async function googleVisionOCR(imageBuffer) {
  const imageBase64 = imageBuffer.toString('base64');
  const [result] = await visionClient.documentTextDetection({ image: { content: imageBase64 } });
  return result.fullTextAnnotation ? result.fullTextAnnotation.text : '';
}

// NodeCanvasFactory for pdfjs-dist in Node.js
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

// Helper to convert PDF pages to images and run OCR
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
      await page.render({
        canvasContext: canvasAndContext.context,
        viewport: viewport,
        canvasFactory: canvasFactory
      }).promise;

      const { width, height } = canvasAndContext.canvas;
      let ocrText = '';
      if (width < 10 || height < 10) {
        ocrText = '[Skipped: Page image too small for OCR]';
      } else {
        const imageBuffer = canvasAndContext.canvas.toBuffer();
        try {
          ocrText = await googleVisionOCR(imageBuffer);
        } catch (ocrErr) {
          // Fallback to Tesseract if Vision fails
          try {
            const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
            ocrText = text;
          } catch (tErr) {
            ocrText = '[OCR failed for this page: ' + (ocrErr.message || tErr.message) + ']';
          }
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

// Preprocess image: convert to grayscale and enhance contrast
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

// Perform OCR on image buffer with Google Vision
const performOCR = async (imageBuffer) => {
  try {
    return await googleVisionOCR(imageBuffer);
  } catch (err) {
    // Fallback to Tesseract.js if Vision fails
    try {
      const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
      return text;
    } catch (tErr) {
      return '[OCR failed: ' + (err.message || tErr.message) + ']';
    }
  }
};

// Configure multer (if not already configured in main server)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
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
    const allowedTypes = [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/bmp',
      'image/webp'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, PowerPoint, and images are allowed.'));
    }
  }
});

exports.uploadFile = [
  upload.single('file'),
  async (req, res) => {
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
        const preprocessed = preprocessImage(imageBuffer);
        extractedText = await performOCR(preprocessed);
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
  }
];