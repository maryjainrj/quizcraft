// src/components/UploadFiles.jsx - Pass extractedTexts to preview
import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QuizSettingsModal from "../components/QuizSettingsModal";
import { generateQuiz } from "../api/quiz";
import { shuffleOptions } from "../utils/Shuffle";

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

  // Modal visibility + settings state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    language: "english",
    type: ["mcq"],
    difficulty: "medium",
    count: 5,
  });

  // File upload / OCR states
  const [extractedTexts, setExtractedTexts] = useState({});
  const [previews, setPreviews] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractionError, setExtractionError] = useState('');
  const [fileInfos, setFileInfos] = useState({});
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Quiz generation states
  const [generatedQuiz, setGeneratedQuiz] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");

  // Extract text from PDF client-side
  const extractTextFromPdfClient = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
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

  // Handle file selection with validation
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

  // Drag and drop handlers
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

  // Extract text for all selected files
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
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        setProgress(((i / files.length) * 100));

        if (file.type === 'application/pdf') {
          const clientText = await extractTextFromPdfClient(file);
          if (clientText && clientText.trim()) {
            newExtractedTexts[fileName] = clientText;
            continue;
          }
        }

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

  // Auto-extract text when files are selected
  useEffect(() => {
    if (files.length > 0 && Object.keys(extractedTexts).length === 0 && !isProcessing) {
      handleExtractText();
    }
  }, [files]);

  // Clear extraction
  const handleClearFile = (fileName) => {
    setExtractedTexts(prev => { const newTexts = { ...prev }; delete newTexts[fileName]; return newTexts; });
    setPreviews(prev => { const newPreviews = { ...prev }; delete newPreviews[fileName]; return newPreviews; });
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
    setGeneratedQuiz([]);
  };

  return (
    <section className="flow">
      <header className="flow__header">
        <h2 className="flow__title">Upload Files</h2>
        <p className="flow__subtitle">Upload your study notes, PDFs, lesson slides, and more.</p>
      </header>

      {/* Dropzone */}
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
          Drag your file(s) or <label htmlFor="file" className="browse-link" onClick={(e) => e.stopPropagation()}>browse</label>
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

      {/* File list */}
      {!!files.length && (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.name} className="file-item">
              <span className="file-item__name">{f.name}</span>
              <span className="file-item__size">{formatSize(f.size)}</span>
              {previews[f.name] && previews[f.name] !== 'pdf' && (
                <img src={previews[f.name]} alt="Preview" style={{ maxWidth: '50px', maxHeight: '50px' }} />
              )}
              {previews[f.name] === 'pdf' && <span>PDF</span>}
              <button onClick={() => handleClearFile(f.name)} style={{ marginLeft: 'auto' }}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      {/* Auto-extraction progress */}
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

      {/* Post-file selection message */}
      {!!files.length && !isProcessing && Object.keys(extractedTexts).length === files.length && (
        <div className="info-message">
          <p>Files added successfully. Click "Create New Quiz" to generate your quiz.</p>
        </div>
      )}

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard/new")}>
          Back
        </button>
        <button 
          className="primary-btn"
          disabled={!files.length || isProcessing || Object.keys(extractedTexts).length < files.length}
          onClick={() => setShowSettings(true)}
        >
          Create New Quiz
        </button>
        {!!files.length && <button className="btn" onClick={handleClearAll}>Clear All</button>}
      </div>

      {/* Quiz Settings Modal */}
      <QuizSettingsModal
        open={showSettings}
        values={settings}
        setValues={setSettings}
        onClose={() => setShowSettings(false)}
        onCreate={async (vals) => {
          setShowSettings(false);
          setQuizLoading(true);
          setQuizError("");

          try {
            const allTexts = Object.values(extractedTexts).join("\n\n---\n\n");
            
            // Handle multiple question types
            const selectedTypes = Array.isArray(vals.type) ? vals.type : [vals.type];
            const questionsPerType = Math.ceil(vals.count / selectedTypes.length);
            
            let allQuestions = [];
            
            // Generate questions for each selected type
            for (const type of selectedTypes) {
              const questionType = 
                type === "mcq" ? "multiple-choice" :
                type === "tf" ? "true-false" :
                "fill-in-blank";
              
              const { questions: rawQuestions } = await generateQuiz(allTexts, {
                questionCount: questionsPerType,
                questionType: questionType,
                difficulty: vals.difficulty,
                language: vals.language,
              });
              
              // Process questions with proper type and shuffle MCQ options
              const processedQuestions = rawQuestions.map((q) => {
                const question = { ...q, type: questionType };
                
                if (questionType === "multiple-choice" && question.options?.length > 0) {
                  return shuffleOptions(question);
                }
                return question;
              });
              
              allQuestions = [...allQuestions, ...processedQuestions];
            }
            
            // Shuffle mix and trim to exact count
            allQuestions = allQuestions
              .sort(() => Math.random() - 0.5)
              .slice(0, vals.count)
              .map((q, idx) => ({ ...q, id: idx + 1 }));

            navigate("/dashboard/quiz-preview", {
              state: {
                questions: allQuestions,
                fileNames: files.map(f => f.name),
                extractedTexts: extractedTexts, // PASS THIS
                settings: {
                  questionTypes: selectedTypes,
                  difficulty: vals.difficulty,
                  count: vals.count,
                },
              },
            });
          } catch (e) {
            setQuizError(e.message || "Failed to generate quiz");
          } finally {
            setQuizLoading(false);
          }
        }}
      />

      {quizLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <p className="text-lg font-semibold">Generating quiz...</p>
          </div>
        </div>
      )}

      {quizError && (
        <div className="alert error mt-4">{quizError}</div>
      )}
    </section>
  );
};

export default UploadFiles;