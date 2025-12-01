#!/usr/bin/env node

/**
 * Diagnostic script to verify Google Vision API setup
 * Run with: node diagnostic.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   QUIZCRAFT GOOGLE VISION API DIAGNOSTIC                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// 1. Check service-account.json
console.log('📋 Step 1: Checking service-account.json file...');
const serviceAccountPath = path.join(__dirname, 'service-account.json');
if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ service-account.json found at:', serviceAccountPath);
  try {
    const content = fs.readFileSync(serviceAccountPath, 'utf8');
    const data = JSON.parse(content);
    console.log('   ✓ Valid JSON format');
    console.log('   ✓ Project ID:', data.project_id);
    console.log('   ✓ Client Email:', data.client_email);
    console.log('   ✓ Private Key:', data.private_key ? '✓ Present (redacted)' : '❌ Missing');
  } catch (err) {
    console.log('❌ Invalid JSON in service-account.json:', err.message);
  }
} else {
  console.log('❌ service-account.json NOT found at:', serviceAccountPath);
}

// 2. Check GOOGLE_APPLICATION_CREDENTIALS env var
console.log('\n📋 Step 2: Checking GOOGLE_APPLICATION_CREDENTIALS env var...');
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('✅ GOOGLE_APPLICATION_CREDENTIALS is set to:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    console.log('   ✓ File exists');
  } else {
    console.log('   ❌ File does not exist');
  }
} else {
  console.log('⚠️  GOOGLE_APPLICATION_CREDENTIALS not set (using keyFilename instead)');
}

// 3. Try to load Vision API module
console.log('\n📋 Step 3: Checking @google-cloud/vision module...');
try {
  const vision = require('@google-cloud/vision');
  console.log('✅ @google-cloud/vision module loaded successfully');
} catch (err) {
  console.log('❌ Failed to load @google-cloud/vision:', err.message);
  console.log('   Install with: npm install @google-cloud/vision');
}

// 4. Try to initialize Vision client
console.log('\n📋 Step 4: Attempting to initialize Vision API client...');
try {
  const vision = require('@google-cloud/vision');
  
  if (fs.existsSync(serviceAccountPath)) {
    const visionClient = new vision.ImageAnnotatorClient({
      keyFilename: serviceAccountPath,
    });
    console.log('✅ Vision API client initialized successfully with keyFilename');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const visionClient = new vision.ImageAnnotatorClient();
    console.log('✅ Vision API client initialized successfully with GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    console.log('❌ Cannot initialize Vision API client - no credentials found');
  }
} catch (err) {
  console.log('❌ Failed to initialize Vision API client:', err.message);
  console.log('\nTroubleshooting tips:');
  console.log('  1. Ensure service-account.json is in the backend folder');
  console.log('  2. Verify the JSON is valid and not truncated');
  console.log('  3. Check that the service account has Vision API permissions');
}

// 5. Check other required modules
console.log('\n📋 Step 5: Checking required Node modules...');
const modules = [
  'pdf-parse',
  'mammoth',
  'pdfjs-dist',
  'canvas',
  'multer',
  'cors',
  'express'
];

for (const mod of modules) {
  try {
    require(mod);
    console.log('✅', mod);
  } catch {
    console.log('❌', mod, '(not installed)');
  }
}

// 6. Test data
console.log('\n📋 Step 6: Summary...');
console.log('\n📌 To fix scanned document OCR issues:');
console.log('   1. Ensure service-account.json is in:', path.join(__dirname));
console.log('   2. Run: npm install (to get all dependencies)');
console.log('   3. Restart the server');
console.log('   4. Check server logs for OCR errors');

console.log('\n📌 Environment variables available:');
console.log('   GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || '(not set)');
console.log('   NODE_ENV:', process.env.NODE_ENV || '(not set)');

console.log('\n✅ Diagnostic complete!\n');
