// src/components/UploadFiles.jsx
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

// -------- Allowed file types --------
const WORD_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const PPT_MIMES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const IMG_PREFIX = "image/";

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
function isPpt(file) {
  const name = (file.name || "").toLowerCase();
  return (
    PPT_MIMES.has(file.type) ||
    name.endsWith(".ppt") ||
    name.endsWith(".pptx")
  );
}
function isImage(file) {
  const name = (file.name || "").toLowerCase();
  return (
    (file.type && file.type.startsWith(IMG_PREFIX)) ||
    /\.(png|jpe?g|webp|bmp)$/i.test(name)
  );
}
function isAllowed(file) {
  return isPdf(file) || isWord(file) || isPpt(file) || isImage(file);
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

  // -------- FRONTEND VALIDATION (PDF, DOC/DOCX, PPT/PPTX, images) --------
  const handleFileSelect = (selectedFiles) => {
    const incoming = Array.from(selectedFiles || []);
    const validationErrors = [];

    incoming.forEach((file) => {
      if (!isAllowed(file)) {
        validationErrors.push(
          `Invalid file type for "${file.name}". Allowed: PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx), or images (PNG/JPG/JPEG/WEBP/BMP).`
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

      if (isImage(file)) {
        const reader = new FileReader();
        reader.onload = (e) =>
          setPreviews((p) => ({ ...p, [fileName]: e.target.result }));
        reader.readAsDataURL(file);
      } else if (isPdf(file)) {
        setPreviews((p) => ({ ...p, [fileName]: "pdf" }));
      } else if (isWord(file)) {
        setPreviews((p) => ({ ...p, [fileName]: "doc" }));
      } else if (isPpt(file)) {
        setPreviews((p) => ({ ...p, [fileName]: "ppt" }));
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

        // For Word, PowerPoint, Images (and PDF fallback), use backend extractor
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("http://localhost:5000/api/upload", {
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
        <p className="flow__subtitle">
          Upload <strong>PDF</strong>, <strong>Word</strong> (.doc/.docx),{" "}
          <strong>PowerPoint</strong> (.ppt/.pptx), or{" "}
          <strong>Images</strong> (PNG/JPG/JPEG/WEBP/BMP).
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
          Max {MAX_MB} MB. Allowed: .pdf, .doc, .docx, .ppt, .pptx, .png, .jpg, .jpeg, .webp, .bmp
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
            ".ppt",
            ".pptx",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".bmp",
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/bmp",
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
              {previews[f.name] && typeof previews[f.name] === "string" && previews[f.name].startsWith("data:") && (
                <img
                  src={previews[f.name]}
                  alt="Preview"
                  style={{ maxWidth: 50, maxHeight: 50, borderRadius: 6 }}
                />
              )}
              {previews[f.name] === "pdf" && <span className="badge">PDF</span>}
              {previews[f.name] === "doc" && <span className="badge">DOC</span>}
              {previews[f.name] === "ppt" && <span className="badge">PPT</span>}

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
          setShowSettings(false);
          try {
            const allTexts = Object.values(extractedTexts).join("\n\n---\n\n");
            const selectedTypes = Array.isArray(vals.type) ? vals.type : [vals.type];
            const perType = Math.ceil(vals.count / selectedTypes.length);
            let allQuestions = [];

            for (const t of selectedTypes) {
              const questionType =
                t === "mcq" ? "multiple-choice" : t === "tf" ? "true-false" : "fill-in-blank";

              const { questions: raw } = await generateQuiz(allTexts, {
                questionCount: perType,
                questionType,
                difficulty: vals.difficulty,
                language: vals.language,
              });

              const processed = raw.map((q) => {
                const base = { ...q, type: questionType };
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

            navigate("/dashboard/quiz-preview", {
              state: {
                questions: allQuestions,
                fileNames: files.map((f) => f.name),
                extractedTexts,
                settings: {
                  questionTypes: selectedTypes,
                  difficulty: vals.difficulty,
                  count: vals.count,
                },
              },
            });
          } catch (e) {
            alert(e.message || "Failed to generate quiz");
          }
        }}
      />
    </section>
  );
}
