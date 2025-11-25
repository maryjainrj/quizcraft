// src/components/UploadFiles.jsx
import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QuizSettingsModal from "./QuizSettingsModal";
import { generateQuiz } from "../api/quiz";
import { shuffleOptions } from "../utils/Shuffle";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -------- Allowed file types --------
const WORD_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function isPdf(file) {
  const name = (file.name || "").toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}
function isWord(file) {
  const name = (file.name || "").toLowerCase();
  return (
    WORD_MIMES.has(file.type) ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  );
}
function isAllowed(file) {
  return isPdf(file) || isWord(file);
}

// ------- Page Range Filtering -------
function parsePageRange(pageRangeStr) {
  if (!pageRangeStr || !pageRangeStr.trim()) return null;
  
  const pages = new Set();
  const parts = pageRangeStr.split(',').map(p => p.trim());
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      }
    } else {
      const pageNum = parseInt(part);
      if (!isNaN(pageNum)) {
        pages.add(pageNum);
      }
    }
  }
  
  return pages.size > 0 ? pages : null;
}

function filterTextByPages(text, pageRange) {
  if (!pageRange) return { text, pageNumbers: [] };
  
  const pages = parsePageRange(pageRange);
  if (!pages) return { text, pageNumbers: [] };
  
  const pageRegex = /--- Page (\d+) ---/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = pageRegex.exec(text)) !== null) {
    const pageNum = parseInt(match[1]);
    const startIndex = match.index;
    
    if (lastIndex > 0) {
      const prevPageNum = parseInt(parts[parts.length - 1]?.pageNum);
      if (pages.has(prevPageNum)) {
        parts[parts.length - 1].content = text.substring(parts[parts.length - 1].startIndex, startIndex);
      }
    }
    
    parts.push({ pageNum, startIndex, content: '' });
    lastIndex = startIndex;
  }
  
  if (parts.length > 0) {
    const lastPageNum = parts[parts.length - 1].pageNum;
    if (pages.has(lastPageNum)) {
      parts[parts.length - 1].content = text.substring(parts[parts.length - 1].startIndex);
    }
  }
  
  const filteredParts = parts.filter(p => pages.has(p.pageNum) && p.content);
  const filteredText = filteredParts.map(p => p.content).join('\n\n');
  const pageNumbers = filteredParts.map(p => p.pageNum);
  
  return { 
    text: filteredText || text, 
    pageNumbers: pageNumbers.length > 0 ? pageNumbers : []
  };
}

// ------- Keyword Filtering -------
function filterTextByKeywords(text, keywordsStr) {
  if (!keywordsStr || !keywordsStr.trim()) return text;
  
  let keywords = [];
  const input = keywordsStr.toLowerCase().trim();
  
  const cleanedInput = input
    .replace(/^(create|generate|make)\s+(quiz|questions?)\s+(from|about|on)\s+/i, '')
    .trim();
  
  const sectionRangeMatch = cleanedInput.match(/(?:from\s+)?(.+?)\s+to\s+(.+?)$/i);
  if (sectionRangeMatch) {
    const [_, startSection, endSection] = sectionRangeMatch;
    
    const chapterMatch = startSection.match(/(\w+)\s+(\d+)/i);
    if (chapterMatch) {
      const [__, type, startNum] = chapterMatch;
      const endMatch = endSection.match(/(\d+)/);
      if (endMatch) {
        const endNum = parseInt(endMatch[1]);
        const start = parseInt(startNum);
        for (let i = start; i <= endNum; i++) {
          keywords.push(`${type} ${i}`.toLowerCase());
        }
      }
    } else {
      const sections = text.split(/\n\n+/);
      const startTerm = startSection.trim();
      const endTerm = endSection.trim();
      
      let startIdx = -1;
      let endIdx = -1;
      
      sections.forEach((section, idx) => {
        const sectionLower = section.toLowerCase();
        if (startIdx === -1 && sectionLower.includes(startTerm)) {
          startIdx = idx;
        }
        if (sectionLower.includes(endTerm)) {
          endIdx = idx;
        }
      });
      
      if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
        return sections.slice(startIdx, endIdx + 1).join('\n\n');
      }
      
      keywords.push(startTerm, endTerm);
    }
  } 
  else if (cleanedInput.includes(',')) {
    keywords = cleanedInput.split(',').map(k => k.trim());
  }
  else {
    keywords = [cleanedInput];
  }
  
  if (keywords.length === 0) return text;
  
  const sections = text.split(/\n\n+/);
  const filteredSections = sections.filter(section => {
    const sectionLower = section.toLowerCase();
    return keywords.some(keyword => sectionLower.includes(keyword));
  });
  
  if (filteredSections.length > 0) {
    return filteredSections.join('\n\n');
  }
  
  return text;
}

export default function UploadFiles() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const source = params.get("source") || "file";

  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  // Modal + settings
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    language: "english",
    type: ["mcq"],
    difficulty: "medium",
    count: 5,
    pageRange: "",
    keywords: "",
    focusArea: "general",
    answerFormat: "brief",
    excludeTopics: "",
  });

  // Upload / extraction state
  const [extractedTexts, setExtractedTexts] = useState({});
  const [previews, setPreviews] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractionError, setExtractionError] = useState("");
  const [fileInfos, setFileInfos] = useState({});
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // ✅ NEW: Quiz generation loading state
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  // Client-side PDF text extraction
  const extractTextFromPdfClient = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((it) => it.str || "").join(" ");
          fullText += `\n--- Page ${i} ---\n${strings}`;
        } catch {
          // keep going even if a page fails
        }
      }
      return fullText.trim();
    } catch {
      return "";
    }
  };

  const handleFileSelect = (selectedFiles) => {
    const incoming = Array.from(selectedFiles || []);
    const validationErrors = [];

    incoming.forEach((file) => {
      if (!isAllowed(file)) {
        validationErrors.push(
          `Invalid file type for "${file.name}". Allowed: PDF or Word (.doc/.docx).`
        );
      }
      if (file.size > MAX_BYTES) {
        validationErrors.push(
          `"${file.name}" is too large. Maximum size is ${MAX_MB}MB.`
        );
      }
    });

    if (validationErrors.length) {
      setError(validationErrors.join("\n"));
      return;
    }

    setError("");
    setFiles(incoming);

    incoming.forEach((file) => {
      const fileName = file.name;
      setFileInfos((prev) => ({
        ...prev,
        [fileName]: {
          name: file.name,
          size: formatSize(file.size),
          type: file.type || "application/octet-stream",
        },
      }));

      if (isPdf(file)) {
        setPreviews((p) => ({ ...p, [fileName]: "pdf" }));
      } else if (isWord(file)) {
        setPreviews((p) => ({ ...p, [fileName]: "doc" }));
      } else {
        setPreviews((p) => ({ ...p, [fileName]: null }));
      }
    });
  };

  const onFiles = useCallback((fileList) => handleFileSelect(fileList), []);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };
  const onBrowse = (e) => onFiles(e.target.files);
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleExtractText = async () => {
    if (!files.length) {
      setExtractionError("Please select files first");
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    setExtractionError("");

    const newExtractedTexts = { ...extractedTexts };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        setProgress((i / files.length) * 100);

        if (isPdf(file)) {
          const clientText = await extractTextFromPdfClient(file);
          if (clientText?.trim()) {
            newExtractedTexts[fileName] = clientText;
            continue;
          }
        }

        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (res.ok && data.success) newExtractedTexts[fileName] = data.text || "";
        else
          setExtractionError(
            `Failed to extract text from ${fileName}: ${
              data.error || data.message || "Unknown error"
            }`
          );
      }

      setExtractedTexts(newExtractedTexts);
      setProgress(100);
    } catch (e) {
      setExtractionError(e.message || "Extraction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (
      files.length > 0 &&
      Object.keys(extractedTexts).length === 0 &&
      !isProcessing
    ) {
      handleExtractText();
    }
  }, [files]);

  const handleClearFile = (fileName) => {
    setExtractedTexts((prev) => {
      const n = { ...prev };
      delete n[fileName];
      return n;
    });
    setPreviews((prev) => {
      const n = { ...prev };
      delete n[fileName];
      return n;
    });
    setFileInfos((prev) => {
      const n = { ...prev };
      delete n[fileName];
      return n;
    });
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleClearAll = () => {
    setFiles([]);
    setExtractedTexts({});
    setPreviews({});
    setFileInfos({});
    setExtractionError("");
    setProgress(0);
    setIsDragActive(false);
  };

  const uploadsReady =
    !!files.length &&
    !isProcessing &&
    Object.keys(extractedTexts).length >= files.length;

  return (
    <section className="flow">
      <header className="flow__header">
        <h2 className="flow__title">Upload Files</h2>
        <p className="subtitle">
          Upload <strong>PDF</strong> or <strong>Word</strong> (.doc/.docx) files.
        </p>
      </header>

      {/* Dropzone */}
      <div
        className={`upload-dropzone ${isDragActive ? "active" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="upload-dropzone__title">
          Drag your file(s) or{" "}
          <label
            htmlFor="file"
            className="browse-link"
            onClick={(e) => e.stopPropagation()}
          >
            browse
          </label>
        </p>
        <p className="upload-dropzone__hint">
          Max {MAX_MB} MB. Allowed: .pdf, .doc, .docx
        </p>
        <input
          ref={fileInputRef}
          id="file"
          type="file"
          accept={[
            ".pdf",
            "application/pdf",
            ".doc",
            ".docx",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].join(",")}
          multiple
          onChange={onBrowse}
          style={{ display: "none" }}
        />
      </div>

      {error && <div className="alert error">{error}</div>}

      {!!files.length && (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.name} className="file-item">
              <span className="file-item__name">{f.name}</span>
              <span className="file-item__size">{formatSize(f.size)}</span>

              {previews[f.name] === "pdf" && <span className="badge">PDF</span>}
              {previews[f.name] === "doc" && <span className="badge">DOC</span>}

              <button onClick={() => handleClearFile(f.name)} style={{ marginLeft: "auto" }}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {isProcessing && (
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}>
              {Math.round(progress)}%
            </div>
          </div>
          <p>Processing files...</p>
        </div>
      )}

      {extractionError && <div className="alert error">{extractionError}</div>}

      {!!files.length &&
        !isProcessing &&
        Object.keys(extractedTexts).length === files.length && (
          <div className="info-message">
            <p>
              Files added successfully. Click <strong>"Create New Quiz"</strong> to generate your quiz.
            </p>
          </div>
        )}

      {/* ✅ NEW: Quiz Generation Loader */}
      {isGeneratingQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center">
              {/* Spinner */}
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              
              {/* Title */}
              <h3 className="text-xl font-bold text-gray-800 mb-2">Generating Your Quiz</h3>
              
              {/* Progress message */}
              <p className="text-gray-600 text-center mb-4">{generationProgress}</p>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 h-full rounded-full animate-pulse"></div>
              </div>
              
              <p className="text-sm text-gray-500 mt-4 text-center">
                This may take a few moments...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard/new")}>
          Back
        </button>
        <button
          className="primary-btn"
          disabled={!uploadsReady || isGeneratingQuiz}
          onClick={() => setShowSettings(true)}
        >
          Create New Quiz
        </button>
        {!!files.length && (
          <button className="btn" onClick={handleClearAll} disabled={isGeneratingQuiz}>
            Clear All
          </button>
        )}
      </div>

      {/* Quiz Settings Modal */}
      <QuizSettingsModal
        open={showSettings}
        values={settings}
        setValues={setSettings}
        onClose={() => setShowSettings(false)}
        onCreate={async (vals) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('QUIZ GENERATION STARTED');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Settings:', vals);
          
          // ✅ Close modal and show loader
          setShowSettings(false);
          setIsGeneratingQuiz(true);
          setGenerationProgress("Preparing content...");
          
          try {
            console.log('\nExtracted texts from files:', Object.keys(extractedTexts));
            
            let allTexts = Object.values(extractedTexts).join("\n\n---\n\n");
            let sourcePages = [];
            
            const pageRegex = /--- Page (\d+) ---/g;
            let match;
            const allPageNumbers = [];
            while ((match = pageRegex.exec(allTexts)) !== null) {
              allPageNumbers.push(parseInt(match[1]));
            }
            
            const uniquePages = [...new Set(allPageNumbers)].sort((a, b) => a - b);
            
            console.log('Initial text length:', allTexts.length, 'characters');
            console.log('Total pages in document:', uniquePages.length);
            
            if (uniquePages.length === 0 && allTexts.length > 0) {
              console.log('⚠️ No page markers found, estimating pages based on text length');
              const estimatedPages = Math.max(1, Math.ceil(allTexts.length / 2500));
              for (let i = 1; i <= estimatedPages; i++) {
                uniquePages.push(i);
              }
            }
            
            // Apply filters
            setGenerationProgress("Applying filters...");
            
            if (vals.pageRange && vals.pageRange.trim()) {
              console.log('\nAPPLYING PAGE RANGE FILTER:', vals.pageRange);
              const beforeLength = allTexts.length;
              const result = filterTextByPages(allTexts, vals.pageRange);
              allTexts = result.text;
              sourcePages = result.pageNumbers;
              console.log('After page filter:', allTexts.length, 'characters');
            } else {
              sourcePages = uniquePages;
            }
            
            if (vals.keywords && vals.keywords.trim()) {
              console.log('\nAPPLYING KEYWORD FILTER:', vals.keywords);
              const beforeLength = allTexts.length;
              allTexts = filterTextByKeywords(allTexts, vals.keywords);
              console.log('After keyword filter:', allTexts.length, 'characters');
            }
            
            if (!allTexts || allTexts.trim().length < 50) {
              console.error('Text too short after filtering:', allTexts.length);
              setIsGeneratingQuiz(false);
              alert('No content found matching your filters. Please adjust page range or keywords.');
              setShowSettings(true);
              return;
            }
            
            const selectedTypes = Array.isArray(vals.type) ? vals.type : [vals.type];
            const perType = Math.ceil(vals.count / selectedTypes.length);
            let allQuestions = [];

            for (let i = 0; i < selectedTypes.length; i++) {
              const t = selectedTypes[i];
              const questionType =
                t === "mcq" ? "multiple-choice" : t === "tf" ? "true-false" : "fill-in-blank";

              // ✅ Update progress for each question type
              setGenerationProgress(
                `Generating ${questionType} questions (${i + 1}/${selectedTypes.length})...`
              );

              console.log(`\nGenerating ${perType} ${questionType} questions...`);
              
              const { questions: raw } = await generateQuiz(allTexts, {
                questionCount: perType,
                questionType,
                difficulty: vals.difficulty,
                language: vals.language,
                focusArea: vals.focusArea,
                answerFormat: vals.answerFormat,
                excludeTopics: vals.excludeTopics,
              });
              
              console.log(`Received ${raw.length} questions from API`);

              const processed = raw.map((q, idx) => {
                let questionPages = [];
                
                if (sourcePages.length > 0) {
                  const pageIndex = idx % sourcePages.length;
                  questionPages = [sourcePages[pageIndex]];
                  
                  if (sourcePages.length > 1 && Math.random() > 0.5) {
                    const secondPageIndex = (pageIndex + 1) % sourcePages.length;
                    if (sourcePages[secondPageIndex] !== sourcePages[pageIndex]) {
                      questionPages.push(sourcePages[secondPageIndex]);
                    }
                  }
                }
                
                const base = { 
                  ...q, 
                  type: questionType,
                  sourcePages: questionPages.length > 0 ? questionPages : undefined,
                  keywords: vals.keywords || undefined,
                  focusArea: vals.focusArea,
                  answerFormat: vals.answerFormat
                };
                
                if (questionType === "multiple-choice" && base.options?.length > 0) {
                  return shuffleOptions(base);
                }
                return base;
              });

              allQuestions = [...allQuestions, ...processed];
            }

            // ✅ Final processing
            setGenerationProgress("Finalizing quiz...");

            allQuestions = allQuestions
              .sort(() => Math.random() - 0.5)
              .slice(0, vals.count)
              .map((q, i) => ({ ...q, id: i + 1 }));

            console.log('\nQUIZ GENERATION COMPLETE');
            console.log('Total questions generated:', allQuestions.length);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            // ✅ Hide loader before navigation
            setIsGeneratingQuiz(false);
            
            navigate("/dashboard/quiz-preview", {
              state: {
                questions: allQuestions,
                fileNames: files.map((f) => f.name),
                extractedTexts,
                settings: {
                  questionTypes: selectedTypes,
                  difficulty: vals.difficulty,
                  count: vals.count,
                  pageRange: vals.pageRange,
                  keywords: vals.keywords,
                  focusArea: vals.focusArea,
                  answerFormat: vals.answerFormat,
                  excludeTopics: vals.excludeTopics,
                  sourcePages: sourcePages.length > 0 ? sourcePages : undefined,
                },
              },
            });
          } catch (e) {
            console.error('Error in onCreate:', e);
            setIsGeneratingQuiz(false);
            alert(e.message || "Failed to generate quiz");
          }
        }}
      />
    </section>
  );
}