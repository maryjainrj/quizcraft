# Scanned Document OCR Troubleshooting Guide

## Issue: Scanned documents are not being recognized/extracted

This guide helps diagnose why scanned PDF documents aren't being processed correctly with the Google Vision API.

---

## Quick Diagnostics

### Step 1: Run the diagnostic script
```bash
cd backend
node diagnostic.js
```

This will check:
- ✅ service-account.json exists and is valid JSON
- ✅ Google Vision API module is installed
- ✅ Vision client can be initialized
- ✅ All required dependencies are present

---

## Common Issues & Solutions

### ❌ Issue 1: "service-account.json not found"

**Symptoms:**
- Server logs show: `⚠️ service-account.json not found and GOOGLE_APPLICATION_CREDENTIALS not set`
- Scanned PDFs show: `[Scanned PDF OCR skipped: Vision API not configured]`

**Cause:** The service account credentials file is missing or in the wrong location.

**Solution:**
1. Ensure `service-account.json` is in the `backend/` folder (root of backend directory)
2. The file should contain JSON with `private_key`, `client_email`, and `project_id`
3. Verify the file permissions: `chmod 600 backend/service-account.json`

**Check:**
```bash
ls -la backend/service-account.json
# Should show the file exists
```

---

### ❌ Issue 2: "Vision API client not initialized"

**Symptoms:**
- Server logs show: `❌ Failed to initialize Vision API client`
- Upload fails with authentication error

**Cause:** The service account credentials are invalid or corrupted.

**Solution:**
1. Open `backend/service-account.json` and verify:
   - It starts with `{` and ends with `}`
   - It contains `private_key` field with a multi-line key starting with `-----BEGIN PRIVATE KEY-----`
   - No fields are truncated or incomplete
   
2. If corrupted, re-download from Google Cloud Console:
   - Go to Google Cloud Console → Service Accounts
   - Find `vision-api-service@quizcraft-474914.iam.gserviceaccount.com`
   - Click "Keys" → "Add Key" → "Create new key" → JSON
   - Replace the content of `service-account.json`

---

### ❌ Issue 3: "@google-cloud/vision not installed"

**Symptoms:**
- Server logs show: `Error: Cannot find module '@google-cloud/vision'`
- Scanned PDFs show: `[Scanned PDF OCR skipped: Vision API not configured]`

**Cause:** Required NPM package is not installed.

**Solution:**
```bash
cd backend
npm install
# Or specifically:
npm install @google-cloud/vision
```

---

### ❌ Issue 4: "Permission denied" or "Insufficient permissions"

**Symptoms:**
- OCR fails with: `Error: 403 Forbidden` or `permission denied`
- Logs show: `❌ Vision API OCR error: Caller does not have permission`

**Cause:** Service account doesn't have Vision API permissions enabled.

**Solution:**
1. Go to Google Cloud Console
2. Project: `quizcraft-474914`
3. Navigate to "APIs & Services" → "Enabled APIs & services"
4. Search for "Cloud Vision API"
5. If not in the list, click "Enable APIs and Services" and enable it
6. Go to Service Accounts → Find `vision-api-service@...`
7. Go to "Roles" → Ensure it has "Editor" or "Cloud Vision API User" role

---

## Testing the Setup

### Test 1: Run diagnostic
```bash
node diagnostic.js
```

Expected output:
```
✅ service-account.json found at: ...
✅ @google-cloud/vision module loaded successfully
✅ Vision API client initialized successfully
```

### Test 2: Test with a scanned PDF

Use Postman or curl:
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@scanned_document.pdf"
```

Expected response:
```json
{
  "success": true,
  "text": "--- Page 1 ---\n[extracted text from OCR]...",
  "filename": "scanned_document.pdf"
}
```

### Test 3: Check server logs

When uploading a file, you should see:
```
📤 Processing file: scanned_document.pdf, type: application/pdf
🔍 Attempting pdf-parse text extraction...
⚠️  No text in pdf-parse, attempting OCR on scanned document...
📄 Running Vision API OCR on page 1...
✅ OCR successful, extracted XXXX characters
✅ Image OCR extracted XXXX characters
```

---

## Environment Variables

If you don't want to use `service-account.json`, you can set the environment variable:

```bash
# In .env file or system environment:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Or pass it to Node:
```bash
GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/service-account.json node server.js
```

---

## File Structure

```
backend/
├── service-account.json          ← Should be HERE
├── server.js
├── diagnostic.js
├── package.json
├── package-lock.json
└── ... (other files)
```

---

## Files Modified

The following files now have improved error handling:

1. **server.js**:
   - Better Vision client initialization with fallback to GOOGLE_APPLICATION_CREDENTIALS
   - Enhanced error logging for OCR operations
   - Detailed progress messages during file processing

2. **diagnostic.js** (NEW):
   - Automated checks for configuration
   - Verifies credentials and permissions

---

## Getting Help

If the issue persists after these checks:

1. Check the console output from `node diagnostic.js`
2. Look at server logs when uploading a file
3. Verify the service account has Vision API enabled
4. Ensure service-account.json is not corrupted
5. Try re-downloading credentials from Google Cloud Console

---

## Key Log Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `✅ Google Vision Client initialized` | Setup OK | None needed |
| `⚠️ service-account.json not found` | Credentials missing | Add file to backend folder |
| `❌ Failed to initialize Vision API client` | Invalid credentials | Verify JSON is correct |
| `[Scanned PDF OCR skipped: Vision API not configured]` | Client is null | Run diagnostic.js |
| `✅ OCR successful, extracted XXXX characters` | Working! | Check text quality |
| `❌ OCR failed for page X:` | Specific page failed | Could be image quality |

---

## Next Steps

After fixing the issue:
1. Run `node diagnostic.js` to verify
2. Restart the server: `npm run dev` or `node server.js`
3. Test uploading a scanned PDF
4. Check the browser console for quiz generation progress
