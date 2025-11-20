// src/components/UploadFiles.jsx
import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QuizSettingsModal from "../components/QuizSettingsModal";
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
  
  // Split by page markers (format: "--- Page X ---")
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
  
  // Handle last page
  if (parts.length > 0) {
    const lastPageNum = parts[parts.length - 1].pageNum;
    if (pages.has(lastPageNum)) {
      parts[parts.length - 1].content = text.substring(parts[parts.length - 1].startIndex);
    }
  }
  
  // Combine filtered pages
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
  
  // Remove common prefixes like "create quiz from", "generate questions from", etc.
  const cleanedInput = input
    .replace(/^(create|generate|make)\s+(quiz|questions?)\s+(from|about|on)\s+/i, '')
    .trim();
  
  // Pattern 1: "X to Y" or "from X to Y" for section ranges
  const sectionRangeMatch = cleanedInput.match(/(?:from\s+)?(.+?)\s+to\s+(.+?)$/i);
  if (sectionRangeMatch) {
    const [_, startSection, endSection] = sectionRangeMatch;
    
    // Check if it's chapter numbers: "chapter 1 to chapter 3"
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
      // It's section names like "introduction to conclusion"
      // Split text into sections and find range
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
        // Return the range of sections
        return sections.slice(startIdx, endIdx + 1).join('\n\n');
      }
      
      // Fallback: use both as keywords
      keywords.push(startTerm, endTerm);
    }
  } 
  // Pattern 2: Comma-separated keywords
  else if (cleanedInput.includes(',')) {
    keywords = cleanedInput.split(',').map(k => k.trim());
  }
  // Pattern 3: Single keyword or phrase
  else {
    keywords = [cleanedInput];
  }
  
  if (keywords.length === 0) return text;
  
  // Split text into sections (paragraphs)
  const sections = text.split(/\n\n+/);
  
  // Filter sections that contain any of the keywords
  const filteredSections = sections.filter(section => {
    const sectionLower = section.toLowerCase();
    return keywords.some(keyword => sectionLower.includes(keyword));
  });
  
  // If we found matching sections, return them; otherwise return original
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

  // -------- FRONTEND VALIDATION (PDF, DOC/DOCX) --------
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

    // Previews/badges
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

        // Try client-only path for PDFs
        if (isPdf(file)) {
          const clientText = await extractTextFromPdfClient(file);
          if (clientText?.trim()) {
            newExtractedTexts[fileName] = clientText;
            continue;
          }
        }

        // For Word (and PDF fallback), use backend extractor
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

  // Auto-extract after files added
  useEffect(() => {
    if (
      files.length > 0 &&
      Object.keys(extractedTexts).length === 0 &&
      !isProcessing
    ) {
      handleExtractText();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

              {/* Thumbnails/badges */}
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

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard/new")}>
          Back
        </button>
        <button
          className="primary-btn"
          disabled={!uploadsReady}
          onClick={() => setShowSettings(true)}
        >
          Create New Quiz
        </button>
        {!!files.length && (
          <button className="btn" onClick={handleClearAll}>
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
          setShowSettings(false);
          try {
            console.log('\nExtracted texts from files:', Object.keys(extractedTexts));
            // Get all extracted texts
            let allTexts = Object.values(extractedTexts).join("\n\n---\n\n");
            let sourcePages = []; // Track which pages were used
            
            // Extract all page numbers from the text
            const pageRegex = /--- Page (\d+) ---/g;
            let match;
            const allPageNumbers = [];
            while ((match = pageRegex.exec(allTexts)) !== null) {
              allPageNumbers.push(parseInt(match[1]));
            }
            
            // Remove duplicates and sort
            const uniquePages = [...new Set(allPageNumbers)].sort((a, b) => a - b);
            
            console.log('Initial text length:', allTexts.length, 'characters');
            console.log('Total pages in document:', uniquePages.length);
            console.log('All unique page numbers:', uniquePages);
            console.log('First 200 chars of original text:', allTexts.substring(0, 200) + '...');
            
            // If no page markers found, estimate pages based on text length
            if (uniquePages.length === 0 && allTexts.length > 0) {
              console.log('⚠️ No page markers found, estimating pages based on text length');
              const estimatedPages = Math.max(1, Math.ceil(allTexts.length / 2500)); // ~2500 chars per page
              for (let i = 1; i <= estimatedPages; i++) {
                uniquePages.push(i);
              }
              console.log('Estimated pages:', uniquePages);
            }
            
            // Apply page range filter if specified
            if (vals.pageRange && vals.pageRange.trim()) {
              console.log('\nAPPLYING PAGE RANGE FILTER:', vals.pageRange);
              const beforeLength = allTexts.length;
              const result = filterTextByPages(allTexts, vals.pageRange);
              allTexts = result.text;
              sourcePages = result.pageNumbers;
              console.log('After page filter:', allTexts.length, 'characters');
              console.log('Pages used:', sourcePages.join(', '));
              console.log('Reduced by:', (beforeLength - allTexts.length), 'characters');
              console.log('First 200 chars after page filter:', allTexts.substring(0, 200) + '...');
            } else {
              // No filter - use all pages
              sourcePages = uniquePages;
              console.log('Using all pages:', sourcePages.length > 0 ? sourcePages.join(', ') : 'NO PAGES FOUND');
            }
            
            // Apply keyword filter if specified
            if (vals.keywords && vals.keywords.trim()) {
              console.log('\nAPPLYING KEYWORD FILTER:', vals.keywords);
              const beforeLength = allTexts.length;
              allTexts = filterTextByKeywords(allTexts, vals.keywords);
              console.log('After keyword filter:', allTexts.length, 'characters');
              console.log('Reduced by:', (beforeLength - allTexts.length), 'characters');
              console.log('First 500 chars after keyword filter:', allTexts.substring(0, 500) + '...');
            }
            
            // Validate that we still have text after filtering
            if (!allTexts || allTexts.trim().length < 50) {
              console.error('Text too short after filtering:', allTexts.length);
              alert('No content found matching your filters. Please adjust page range or keywords.');
              setShowSettings(true);
              return;
            }
            
            console.log('\nFINAL FILTERED TEXT:', allTexts.length, 'characters');
            console.log('Text being sent to AI:\n', allTexts.substring(0, 800) + '\n...\n');
            
            const selectedTypes = Array.isArray(vals.type) ? vals.type : [vals.type];
            console.log('\nSelected question types:', selectedTypes);
            const perType = Math.ceil(vals.count / selectedTypes.length);
            let allQuestions = [];

            for (const t of selectedTypes) {
              const questionType =
                t === "mcq" ? "multiple-choice" : t === "tf" ? "true-false" : "fill-in-blank";

              console.log(`\nGenerating ${perType} ${questionType} questions...`);
              console.log('API Request params:', {
                textLength: allTexts.length,
                questionCount: perType,
                questionType,
                difficulty: vals.difficulty,
                language: vals.language,
                focusArea: vals.focusArea,
                answerFormat: vals.answerFormat,
                excludeTopics: vals.excludeTopics,
              });
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
              console.log('Sample question:', raw[0]);

              const processed = raw.map((q, idx) => {
                // Try to determine which specific page(s) this question came from
                let questionPages = [];
                
                if (sourcePages.length > 0) {
                  // Simple approach: distribute questions across available pages
                  // This ensures each question gets a page assignment
                  const pageIndex = idx % sourcePages.length;
                  questionPages = [sourcePages[pageIndex]];
                  
                  // Optionally add a second page if available
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
                
                // Debug log every question's sourcePages
                console.log(`Question ${idx + 1} assigned to pages:`, base.sourcePages);
                
                if (questionType === "multiple-choice" && base.options?.length > 0) {
                  return shuffleOptions(base);
                }
                return base;
              });

              allQuestions = [...allQuestions, ...processed];
            }

            allQuestions = allQuestions
              .sort(() => Math.random() - 0.5)
              .slice(0, vals.count)
              .map((q, i) => ({ ...q, id: i + 1 }));

            console.log('\nQUIZ GENERATION COMPLETE');
            console.log('Total questions generated:', allQuestions.length);
            console.log('Navigating to quiz-preview...');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
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
            alert(e.message || "Failed to generate quiz");
          }
        }}
      />
    </section>
  );
}
