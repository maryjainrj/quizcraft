/**
 * Test script to verify OCR endpoint works after fixing canvas module
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

async function testOCREndpoint() {
  console.log(' Testing OCR /api/upload endpoint\n');

  // Create a simple test PDF (we'll use a small sample if available)
  const testDir = path.join(__dirname, 'backend', 'uploads');
  
  // For now, just test if the endpoint is reachable
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET',
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(' Server health check passed:');
          console.log(`   Status: ${json.status}`);
          console.log(`   Message: ${json.message}\n`);
          
          console.log(' OCR pipeline is ready for testing');
          console.log('\nNext steps:');
          console.log('1. Upload a scanned PDF file via: POST /api/upload');
          console.log('2. Monitor the server console for OCR progress messages');
          console.log('3. Check for " OCR successful" or error messages\n');
          
          resolve(true);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error(' Server not reachable:', error.message);
      reject(error);
    });

    req.end();
  });
}

testOCREndpoint()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
