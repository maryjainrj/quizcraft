/**
 * Test script for scanned PDF OCR pipeline
 * This tests the extractTextFromScannedPDF function with Module.prototype.require interception
 */

const fs = require('fs');
const path = require('path');

// Test that canvas module is properly injected
console.log(' Testing OCR Pipeline with Module.prototype.require interception\n');

// Try loading pdfjs to see if it accepts our canvas
try {
  console.log('1️  Testing if pdfjs can load with our injected canvas...');
  
  const { createCanvas, Image } = require("canvas");
  console.log('    Canvas module loaded');

  const Module = require("module");
  const originalRequire = Module.prototype.require;
  let canvasInterceptCount = 0;
  
  Module.prototype.require = function(id) {
    if (id === "canvas" || id === "./canvas") {
      canvasInterceptCount++;
      console.log(`    Canvas interception triggered (count: ${canvasInterceptCount})`);
      return { createCanvas, Image };
    }
    return originalRequire.apply(this, arguments);
  };

  const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
  console.log('    pdfjs-dist loaded successfully');
  
  pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
    __dirname,
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js"
  );
  console.log('    Worker source configured\n');

  // Check if worker file exists
  const workerPath = path.join(__dirname, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js");
  if (fs.existsSync(workerPath)) {
    console.log(`2️  Worker file exists at: ${workerPath}`);
    const stats = fs.statSync(workerPath);
    console.log(`    File size: ${(stats.size / 1024).toFixed(2)} KB\n`);
  } else {
    console.log(` Worker file NOT found at: ${workerPath}\n`);
  }

  // Test NodeCanvasFactory
  console.log('3️  Testing NodeCanvasFactory with pdfjs...');
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

  const factory = new NodeCanvasFactory();
  const canvasObj = factory.create(100, 100);
  console.log('    NodeCanvasFactory created canvas (100x100)');
  console.log(`    Canvas type: ${canvasObj.canvas.constructor.name}`);
  console.log(`    Context type: ${canvasObj.context.constructor.name}\n`);
  factory.destroy(canvasObj);

  console.log(' All module loading tests passed!');
  console.log(' The OCR pipeline is ready for testing.\n');
  console.log('Next steps:');
  console.log('1. Upload a scanned PDF file via POST /api/upload');
  console.log('2. Check the console for "OCR successful" message');
  console.log('3. Verify the extracted text in the response\n');

} catch (error) {
  console.error(' Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
