import React, { useState, useRef } from "react";
import "./Dashboard.css";
import "./Auth.css";
import quizcraftwhite from "../assets/quizcraftwhite.png";
import { FaSearch, FaChevronDown } from "react-icons/fa";

const Dashboard = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const profilePic = "https://i.pravatar.cc/150?img=3";
  // File upload / OCR states for "From File" flow
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Try to extract text client-side for PDFs (fast for text PDFs)
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

  const handleFileSelect = (selectedFile) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Only PDF and images are allowed.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(selectedFile);
    setError('');
    setExtractedText('');
    setProgress(0);
    setFileInfo({
      name: selectedFile.name,
      size: (selectedFile.size / 1024).toFixed(2) + ' KB',
      type: selectedFile.type
    });

    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type === 'application/pdf') {
      setPreview('pdf');
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleExtractText = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError('');
    setExtractedText('');

    try {
      // If PDF, try client-side extraction first (works for text PDFs)
      if (selectedFile.type === 'application/pdf') {
        const clientText = await extractTextFromPdfClient(selectedFile);
        if (clientText && clientText.trim()) {
          setExtractedText(clientText);
          setProgress(100);
          setIsProcessing(false);
          return;
        }
        // else fall through to server upload (for scanned PDFs)
      }

      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExtractedText(data.text || '');
        setProgress(100);
      } else {
        setError(data.error || data.message || 'Failed to extract text');
      }
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText).then(() => {
      alert('Text copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy text');
    });
  };

  const handleDownload = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setExtractedText('');
    setError('');
    setFileInfo(null);
    setProgress(0);
    setIsDragActive(false);
  };

  const handleCloseModal = () => {
    handleClear();
    setShowFileModal(false);
  };

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="auth-logo">
          <img src={quizcraftwhite} alt="QuizzCraft logo" />
        </div>
        <nav className="sidebar-nav">
          <button className="nav-btn active">Dashboard</button>
          <button className="nav-btn">Share Quiz</button>
          <button className="nav-btn">Export Quiz</button>
        </nav>
      </aside>

      {/* Main section */}
      <div className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="search-container">
            <input type="text" placeholder="Search..." />
            <FaSearch className="search-icon" />
          </div>

          <div className="profile-container" onClick={() => setShowDropdown(!showDropdown)}>
            <img src={profilePic} alt="Profile" className="profile-pic" />
            <span className="username">John Doe</span>
            <FaChevronDown className="dropdown-icon" />
            {showDropdown && (
              <div className="dropdown-menu">
                <button>Logout</button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="dashboard-content">
          <h3>Welcome to Quiz Dashboard</h3>
          <p>Manage your quiz questions here. You can edit and delete questions.</p>

          <div className="quiz-options">
            <div className="quiz-card">
              <h3>From File</h3>
              <p>Create quiz based on your uploading file.</p>
              <button onClick={() => setShowFileModal(true)}>Add New Quiz</button>
            </div>

            <div className="quiz-card">
              <h3>From Text</h3>
              <p>Create quiz based on your written text.</p>
              <button>Add New Quiz</button>
            </div>
          </div>

          {/* Upload Files section - Direct drag/drop/browse */}
          <div 
            className={`upload-box ${isDragActive ? 'active' : ''}`}
            onClick={handleDropzoneClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <h4>Upload Files</h4>
            <p>Drag your file(s) or browse</p>
            <p>Max 10 MB files are allowed (PDF only)</p>
          </div>

          {/* Hidden file input for browse */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.bmp,.webp"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />

          {/* File import modal for "Add New Quiz" - With Extract Button */}
          {showFileModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Import from File</h3>
                <p>Select a PDF or image to extract text and create a quiz.</p>

                <div 
                  className={`dropzone ${isDragActive ? 'active' : ''}`}
                  onClick={handleDropzoneClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.bmp,.webp"
                    style={{ display: 'none' }}
                    onChange={handleFileInputChange}
                  />
                  <div className="upload-icon">Upload File</div>
                  {isDragActive ? (
                    <p className="dropzone-text">Drop the file here...</p>
                  ) : (
                    <>
                      <h3>Click or Drag & Drop to Upload</h3>
                      <p>Select a PDF or Image file (Max 10MB)</p>
                    </>
                  )}
                </div>

                {fileInfo && (
                  <div className="file-info">
                    <strong>Selected:</strong> {fileInfo.name} — {fileInfo.size}
                  </div>
                )}

                {error && <div className="error-box">{error}</div>}

                {isProcessing && (
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }}>
                        {progress}%
                      </div>
                    </div>
                    <p className="progress-text">Processing your file...</p>
                  </div>
                )}

                {preview && preview !== 'pdf' && (
                  <div className="preview-section">
                    <img src={preview} alt="Preview" style={{ maxWidth: '200px' }} />
                  </div>
                )}

                {preview === 'pdf' && (
                  <div className="preview-section">PDF selected</div>
                )}

                <div className="modal-controls">
                  {selectedFile && (
                    <button className="btn btn-primary" onClick={handleExtractText} disabled={isProcessing}>
                      {isProcessing ? 'Processing...' : 'Extract Text'}
                    </button>
                  )}
                  {selectedFile && (
                    <button className="btn" onClick={handleClear}>
                      Clear
                    </button>
                  )}
                  <button className="btn" onClick={handleCloseModal}>
                    Cancel
                  </button>
                </div>

                {/* Extracted text displays here after extraction */}
                {extractedText && (
                  <div className="result-section" style={{ marginTop: 12 }}>
                    <h4>Extracted Text</h4>
                    <div className="result-box" style={{ maxHeight: 200, overflow: 'auto' }}>{extractedText}</div>
                    <div style={{ marginTop: 8 }}>
                      <button className="btn" onClick={handleCopy}>Copy</button>
                      <button className="btn" onClick={handleDownload}>Download</button>
                      <button className="btn" onClick={handleCloseModal}>Done</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="dashboard-empty">
            No quiz available <br />
            Currently, there are no quizzes. Please add a new quiz.
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;