const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const pdfParse = require('pdf-parse');
console.log('SUCCESS: pdfjs-dist version:', require('pdfjs-dist/package.json').version);
console.log('SUCCESS: pdf-parse callable:', typeof pdfParse === 'function');