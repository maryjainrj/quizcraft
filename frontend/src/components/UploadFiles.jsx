import React, { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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

  const validate = (list) => {
    for (const f of list) {
      if (f.size > MAX_BYTES) {
        return `“${f.name}” exceeds ${MAX_MB} MB limit.`;
      }
    }
    return "";
  };

  const onFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []);
    const err = validate(arr);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setFiles(arr);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      onFiles(e.dataTransfer.files);
    }
  };

  const onBrowse = (e) => {
    onFiles(e.target.files);
  };

  const onDragOver = (e) => e.preventDefault();

  return (
    <section className="flow">
      <header className="flow__header">
        <h2 className="flow__title">Upload Files</h2>
        <p className="flow__subtitle">Upload your study notes, PDFs, lesson slides, and more.</p>
      </header>

      <div
        className="upload-dropzone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        role="button"
        tabIndex={0}
      >
        <p className="upload-dropzone__title">Drag your file(s) or <label htmlFor="file" className="browse-link">browse</label></p>
        <p className="upload-dropzone__hint">Max {MAX_MB} MB files are allowed</p>
        <input
          id="file"
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
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
            </li>
          ))}
        </ul>
      )}

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard/new")}>
          Back
        </button>
        <button
          className="primary-btn"
          disabled={!files.length}
          onClick={() => alert("Stub: upload & create quiz")}
        >
          Create Quiz
        </button>
      </div>
    </section>
  );
};

export default UploadFiles;
