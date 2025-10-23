import React, { useCallback, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QuizSettingsModal from "./QuizSettingsModal";

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const UploadFiles = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const source = params.get("source") || "file";

  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  // NEW: modal visibility + settings state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    language: "en",      // only English for now
    type: "fill",        // 'fill' | 'mcq' | 'tf'
    difficulty: "hard",  // 'easy' | 'medium' | 'hard'
    count: 20,           // slider 6..30
  });

  // INTEGRATED: File upload / OCR states for "From File" flow
  const [extractedTexts, setExtractedTexts] = useState({}); // {fileName: text}
  const [previews, setPreviews] = useState({}); // {fileName: preview}
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractionError, setExtractionError] = useState('');
  const [fileInfos, setFileInfos] = useState({}); // {fileName: info}
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // INTEGRATED: Try to extract text client-side for PDFs (fast for text PDFs)
  const extractTextFromPdfClient = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // dynamic import to avoid bundling when not needed
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((it) => it.str || '').join(' ');
          fullText += '\n--- Page ' + i + ' ---\n' + strings;
        } catch (e) {
          // ignore page errors
        }
      }
      return fullText.trim();
    } catch (err) {
      console.error('Client PDF extraction failed:', err);
      return '';
    }
  };

  // INTEGRATED: Handle file selection with validation and preview
  const handleFileSelect = (selectedFiles) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain'];
    const newFiles = Array.from(selectedFiles || []);
    const validationErrors = [];

    newFiles.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        validationErrors.push(`Invalid file type for "${file.name}". Only PDF, images, DOC, PPT, TXT are allowed.`);
      }
      if (file.size > MAX_BYTES) {
        validationErrors.push(`"${file.name}" too large. Maximum size is ${MAX_MB}MB.`);
      }
    });

    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'));
      return;
    }

    setError('');
    setFiles(newFiles);

    // Set previews and file info
    newFiles.forEach((file) => {
      const fileName = file.name;
      setFileInfos(prev => ({ ...prev, [fileName]: {
        name: file.name,
        size: formatSize(file.size),
        type: file.type
      } }));

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviews(prev => ({ ...prev, [fileName]: e.target.result }));
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        setPreviews(prev => ({ ...prev, [fileName]: 'pdf' }));
      } else {
        setPreviews(prev => ({ ...prev, [fileName]: null }));
      }
    });
  };

  const onFiles = useCallback((fileList) => {
    handleFileSelect(fileList);
  }, []);

  // INTEGRATED: Drag and drop handlers
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files?.length) {
      onFiles(e.dataTransfer.files);
    }
  };

  const onBrowse = (e) => {
    onFiles(e.target.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  // INTEGRATED: Extract text for all selected files
  const handleExtractText = async () => {
    if (!files.length) {
      setExtractionError('Please select files first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setExtractionError('');
    const newExtractedTexts = { ...extractedTexts };

    try {
      // Process files sequentially to avoid overwhelming the server
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        setProgress(((i / files.length) * 100));

        // If PDF, try client-side extraction first
        if (file.type === 'application/pdf') {
          const clientText = await extractTextFromPdfClient(file);
          if (clientText && clientText.trim()) {
            newExtractedTexts[fileName] = clientText;
            continue;
          }
          // else fall through to server
        }

        // Server-side extraction for non-text PDFs or other formats
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          newExtractedTexts[fileName] = data.text || '';
        } else {
          setExtractionError(`Failed to extract text from ${fileName}: ${data.error || data.message || 'Unknown error'}`);
        }
      }
      setExtractedTexts(newExtractedTexts);
      setProgress(100);
    } catch (e) {
      setExtractionError(e.message || 'Extraction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // INTEGRATED: Copy and download handlers per file
  const handleCopy = (fileName) => {
    const text = extractedTexts[fileName];
    navigator.clipboard.writeText(text).then(() => {
      alert(`Text from ${fileName} copied to clipboard!`);
    }).catch(() => {
      alert('Failed to copy text');
    });
  };

  const handleDownload = (fileName) => {
    const text = extractedTexts[fileName];
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-${fileName.replace(/\.[^/.]+$/, "")}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // INTEGRATED: Clear extraction for a file or all
  const handleClearFile = (fileName) => {
    setExtractedTexts(prev => ({ ...prev, [fileName]: '' }));
    setPreviews(prev => ({ ...prev, [fileName]: null }));
    setFileInfos(prev => { const newInfo = { ...prev }; delete newInfo[fileName]; return newInfo; });
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleClearAll = () => {
    setFiles([]);
    setExtractedTexts({});
    setPreviews({});
    setFileInfos({});
    setExtractionError('');
    setProgress(0);
    setIsDragActive(false);
  };

  const validate = (list) => {
    for (const f of list) {
      if (f.size > MAX_BYTES) {
        return `“${f.name}” exceeds ${MAX_MB} MB limit.`;
    }
  }
  return "";
};

  return (
    <section className="flow">
      <header className="flow__header">
        <h2 className="flow__title">Upload Files</h2>
        <p className="flow__subtitle">Upload your study notes, PDFs, lesson slides, and more.</p>
      </header>

      {/* INTEGRATED: Enhanced dropzone with drag active state */}
      <div
        className={`upload-dropzone ${isDragActive ? 'active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="upload-dropzone__title">
          Drag your file(s) or <label htmlFor="file" className="browse-link">browse</label>
        </p>
        <p className="upload-dropzone__hint">Max {MAX_MB} MB files are allowed (PDF, images, DOC, PPT, TXT)</p>
        <input
          ref={fileInputRef}
          id="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.bmp,.webp,.doc,.docx,.ppt,.pptx,.txt"
          multiple
          onChange={onBrowse}
          style={{ display: "none" }}
        />
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* INTEGRATED: File list with previews and extraction controls */}
      {!!files.length && (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.name} className="file-item">
              <span className="file-item__name">{f.name}</span>
              <span className="file-item__size">{formatSize(f.size)}</span>
              {/* Preview */}
              {previews[f.name] && previews[f.name] !== 'pdf' && (
                <img src={previews[f.name]} alt="Preview" style={{ maxWidth: '50px', maxHeight: '50px' }} />
              )}
              {previews[f.name] === 'pdf' && <span>PDF</span>}
              {/* Per-file clear */}
              <button onClick={() => handleClearFile(f.name)} style={{ marginLeft: 'auto' }}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      {/* INTEGRATED: Extraction button and progress */}
      {!!files.length && (
        <div className="extraction-section">
          <button 
            className="btn" 
            onClick={handleExtractText} 
            disabled={isProcessing || Object.keys(extractedTexts).length === files.length}
          >
            {isProcessing ? 'Extracting...' : 'Extract Text from Files'}
          </button>
          {isProcessing && (
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}>
                  {progress}%
                </div>
              </div>
              <p>Processing files...</p>
            </div>
          )}
          {extractionError && <div className="alert error">{extractionError}</div>}
        </div>
      )}

      {/* INTEGRATED: Display extracted texts per file */}
      {Object.keys(extractedTexts).length > 0 && (
        <div className="extracted-texts">
          <h4>Extracted Texts</h4>
          {Object.entries(extractedTexts).map(([fileName, text]) => (
            <div key={fileName} className="result-section">
              <h5>{fileName}</h5>
              <div className="result-box" style={{ maxHeight: 150, overflow: 'auto' }}>{text}</div>
              <div>
                <button className="btn" onClick={() => handleCopy(fileName)}>Copy</button>
                <button className="btn" onClick={() => handleDownload(fileName)}>Download</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard/new")}>
          Back
        </button>
        <button 
          className="primary-btn"
          disabled={!files.length || isProcessing || Object.keys(extractedTexts).length < files.length}
          onClick={() => setShowSettings(true)}   // Open settings after extraction
        >
          Create New Quiz
        </button>
        {!!files.length && <button className="btn" onClick={handleClearAll}>Clear All</button>}
      </div>

      {/* Quiz Settings Modal - Pass extracted texts if needed */}
      <QuizSettingsModal
        open={showSettings}
        values={settings}
        setValues={setSettings}
        onClose={() => setShowSettings(false)}
        onCreate={(vals) => {
          setShowSettings(false);
          // INTEGRATED: Include extracted texts in the create call
          const allTexts = Object.values(extractedTexts).join('\n\n---\n\n');
          // TODO: call your API with { files, extractedTexts: allTexts, settings: vals }
          alert(
            `Create quiz with:\n` +
            `- Language: ${vals.language}\n` +
            `- Type: ${vals.type}\n` +
            `- Difficulty: ${vals.difficulty}\n` +
            `- Questions: ${vals.count}\n` +
            `Files: ${files.map(f => f.name).join(", ")}\n` +
            `Extracted Text Length: ${allTexts.length} chars`
          );
        }}
      />
    </section>
  );
};

export default UploadFiles;