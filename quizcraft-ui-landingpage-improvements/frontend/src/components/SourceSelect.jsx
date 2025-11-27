import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const SourceSelect = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null); // "file" | "text" | null

  const goNext = () => {
    if (selected === "file") navigate("/dashboard/new/upload?source=file");
    if (selected === "text") navigate("/dashboard/new/text");
  };

  return (
    <section className="flow">
      <header className="flow__header">
        <h2 className="flow__title">Select a source to create question</h2>
        <p className="flow__subtitle">Choose how you want to generate question.</p>
      </header>

      <div className="source-grid">
        <button
          type="button"
          className={`source-card selectable ${selected === "file" ? "active" : ""}`}
          onClick={() => setSelected("file")}
        >
          <h3>From File</h3>
          <p>Create quiz based on your uploaded file.</p>
        </button>

        <button
          type="button"
          className={`source-card selectable ${selected === "text" ? "active" : ""}`}
          onClick={() => setSelected("text")}
        >
          <h3>From Text</h3>
          <p>Create quiz based on your written text.</p>
        </button>
      </div>

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard")}>
          Back
        </button>
        <button
          className="primary-btn"
          onClick={goNext}
          disabled={!selected}
        >
          Add New Quiz
        </button>
      </div>
    </section>
  );
};

export default SourceSelect;
