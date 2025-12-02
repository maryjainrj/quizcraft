# Quick Fix Checklist: Scanned Document OCR Not Working

## 🚀 Quick Start

1. **Verify setup:**
   ```bash
   cd backend
   node diagnostic.js
   ```

2. **Ensure dependencies are installed:**
   ```bash
   npm install
   ```

3. **Restart the server:**
   ```bash
   npm run dev
   # or
   node server.js
   ```

4. **Test with a scanned PDF:**
   - Upload a scanned PDF document through the QuizCraft UI
   - Check browser console and server logs

---

## ✅ What Was Fixed

### Files Modified:
- **`backend/server.js`** - Enhanced Vision API initialization and error handling
- **`backend/diagnostic.js`** (NEW) - Automated diagnostics tool
- **`backend/SCANNED_DOCS_FIX.md`** (NEW) - Complete troubleshooting guide

### Key Improvements:

1. **Better Error Handling**
   - Vision client initialization now wrapped in try-catch
   - Detailed console logging at each step
   - Fallback support for GOOGLE_APPLICATION_CREDENTIALS environment variable

2. **Improved Diagnostics**
   - `googleVisionOCR()` now checks if client is initialized
   - Each OCR operation is logged with emojis for easy scanning
   - Detailed error messages help identify the problem

3. **Enhanced Upload Endpoint**
   - Better error logging for scanned PDFs
   - Fallback logic: tries pdf-parse first, then Vision API OCR
   - Clear distinction between text extraction failure and OCR failure

---

## 🔍 How to Troubleshoot

### Scenario 1: Scanned PDF shows "[Scanned PDF OCR skipped: Vision API not configured]"
- **Cause:** Vision client is null
- **Fix:** 
  1. Run `node diagnostic.js` 
  2. Check that `service-account.json` exists in `backend/`
  3. Restart server

### Scenario 2: Upload fails with authentication error
- **Cause:** service-account.json is invalid or missing credentials
- **Fix:**
  1. Open `backend/service-account.json`
  2. Verify it's valid JSON with `private_key` field
  3. If corrupted, re-download from Google Cloud Console
  4. Restart server

### Scenario 3: Module not found error
- **Cause:** @google-cloud/vision not installed
- **Fix:**
  ```bash
  cd backend
  npm install
  ```

---

## 📊 Expected Behavior

When uploading a **regular PDF** (with text):
```
✅ pdf-parse extracted XXXX characters
[Quiz generated successfully]
```

When uploading a **scanned PDF** (image-based):
```
⚠️  No text in pdf-parse, attempting OCR on scanned document...
📄 Running Vision API OCR on page 1...
✅ OCR successful, extracted XXXX characters
[Quiz generated from OCR text]
```

---

## 🛠️ Configuration

**Backend Directory Structure:**
```
backend/
├── service-account.json    ← Service account credentials (MUST be here)
├── server.js               ← Main server file (MODIFIED)
├── diagnostic.js           ← Diagnostics tool (NEW)
└── SCANNED_DOCS_FIX.md     ← Full troubleshooting guide (NEW)
```

---

## 📝 Server Log Examples

### ✅ Success Logs:
```
🔍 Looking for service account at: /path/to/backend/service-account.json
📁 File exists: true
✅ Google Vision Client initialized with service account
📤 Processing file: scan.pdf, type: application/pdf
🔍 Attempting pdf-parse text extraction...
⚠️  No text in pdf-parse, attempting OCR on scanned document...
📄 Running Vision API OCR on page 1...
✅ OCR successful, extracted 1234 characters
```

### ❌ Error Logs & Fixes:
```
⚠️  service-account.json not found
→ FIX: Copy service-account.json to backend folder

❌ Failed to initialize Vision API client: ENOENT
→ FIX: Check file path and permissions

❌ Vision API OCR error: 403 Forbidden
→ FIX: Enable Vision API in Google Cloud Console
```

---

## 📚 Additional Resources

- Full Guide: `backend/SCANNED_DOCS_FIX.md`
- Diagnostic Tool: `node backend/diagnostic.js`
- Server Logs: Check console output when uploading files

---

## 🎯 Next Steps

1. Run diagnostic tool: `node backend/diagnostic.js`
2. Fix any issues it identifies
3. Restart server: `npm run dev`
4. Test with a scanned PDF
5. Check logs for detailed error messages
6. If still not working, refer to `SCANNED_DOCS_FIX.md`

---

**All fixes maintain backward compatibility - existing functionality continues to work!**
