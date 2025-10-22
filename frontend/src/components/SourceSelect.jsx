import React from "react";
import { useNavigate } from "react-router-dom";

const SourceSelect = () => {
  const navigate = useNavigate();

  return (
    <section className="flow">
      <header className="flow__header">
        <h2 className="flow__title">Select a source to create question</h2>
        <p className="flow__subtitle">Choose how you want to generate question.</p>
      </header>

      <div className="source-grid">
        <div className="source-card">
          <h3>From File</h3>
          <p>Create quiz based on your uploaded file.</p>
        </div>
        <div className="source-card">
          <h3>From Text</h3>
          <p>Create quiz based on your written text.</p>
        </div>
      </div>

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard")}>
          Back
        </button>
        <button
          className="primary-btn"
          onClick={() => navigate("/dashboard/new/upload?source=file")}
        >
          Add New Quiz
        </button>
      </div>
    </section>
  );
};

export default SourceSelect;
