// src/components/QuizDetailPage.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const sampleById = {
  "1": {
    title: "Entry-Level Accounting Professional Seeking Opportunities",
    questions: [
      "According to the passage, one of the ways in which analog recording systems differ from digital recording systems is that analog systems…",
      "Which statement best summarizes the author’s goal in the objective section?",
      "What tool is specifically mentioned as a strength?",
    ],
    answers: [
      "They record continuous signals as opposed to discrete samples.",
      "To present the candidate as motivated and ready for an entry-level role.",
      "TALLY.",
    ],
  },
  "2": {
    title: "World History – Renaissance & Reformation",
    questions: [
      "Which concept most closely aligns with Renaissance humanism?",
      "Name one prominent Reformation leader discussed in the notes.",
      "Which city is often associated with the Medici family’s patronage of the arts?",
    ],
    answers: [
      "Emphasis on classical learning and human potential.",
      "Martin Luther.",
      "Florence.",
    ],
  },
};

export default function QuizDetailPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [showAnswers, setShowAnswers] = useState(true);

  // action modals
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const quiz = useMemo(() => {
    if (state?.title) {
      return {
        title: state.title,
        questions: sampleById[id]?.questions || [],
        answers: sampleById[id]?.answers || [],
      };
    }
    return sampleById[id] || { title: "Quiz", questions: [], answers: [] };
  }, [id, state]);

  const shareUrl = `${window.location.origin}/dashboard/quiz/${id}`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Link copied to clipboard");
    }
  };

  const handleDelete = () => {
    // Front-end only: pretend it’s deleted and go back to list
    // (In real app, call your API then update store and navigate)
    alert("Quiz deleted");
    navigate("/dashboard", { replace: true });
  };

  return (
    <section>
      {/* Header + actions */}
      <div className="detail-header">
        <button className="secondary-btn back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="detail-heading">
          <h1 className="feed-title">Quiz</h1>
          <p className="feed-subtitle">
            Manage your quiz questions here. You can edit and delete questions. This
            page is preview page for your questions.
          </p>
        </div>

        <div className="detail-actions">
          {/* <button className="secondary-btn" onClick={() => setShowExport(true)}>
            Export
          </button>
          <button className="secondary-btn" onClick={() => setShowShare(true)}>
            Share
          </button> */}
          <button
            className="danger-btn"
            onClick={() => setShowDelete(true)}
            aria-label="Delete quiz"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Available Questions */}
      <div className="panel">
        <div className="panel__header">
          <h3>Available Questions</h3>
        </div>
        <ul className="question-list">
          {quiz.questions.map((q, idx) => (
            <li key={idx} className="question-row">
              <span className="q-index">{idx + 1}.</span>
              <span className="q-text">{q}</span>
              <button className="kebab" aria-label="More actions">
                ⋮
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* View Answers */}
      <div className="panel">
        <div className="panel__header">
          <h3>View Answers</h3>
          <button
            className="chevron"
            aria-label="Toggle answers"
            onClick={() => setShowAnswers((s) => !s)}
          >
            {showAnswers ? "▾" : "▸"}
          </button>
        </div>

        {showAnswers && (
          <ul className="question-list">
            {quiz.answers.map((a, idx) => (
              <li key={idx} className="question-row">
                <span className="q-index">{idx + 1}.</span>
                <span className="q-text">{a}</span>
                <button className="kebab" aria-label="More actions">
                  ⋮
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===== Modals ===== */}

      {/* Export Modal */}
      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Export Quiz</h3>
            <p className="modal-subtitle">
              Manage your quiz questions here. You can edit and delete questions.
            </p>

            <div className="export-list">
              <button className="export-item" onClick={() => alert("Export questions (stub)")}>
                <div className="export-icon">📄</div>
                <div className="export-body">
                  <div className="export-title">Export pdf questions</div>
                  <div className="export-desc">
                    Download the questions in PDF format. With your logo and colors.
                  </div>
                </div>
              </button>
              <button className="export-item" onClick={() => alert("Export answers (stub)")}>
                <div className="export-icon">📄</div>
                <div className="export-body">
                  <div className="export-title">Export pdf Answers</div>
                  <div className="export-desc">
                    Download the questions in PDF format. With your logo and colors.
                  </div>
                </div>
              </button>
            </div>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setShowExport(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShare && (
        <div className="modal-overlay" onClick={() => setShowShare(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Share this Questions</h3>
            <p className="modal-subtitle">
              If you like this article share it with your friends.
            </p>

            <div className="share-row">
              <input className="share-input" value={shareUrl} readOnly />
              <button className="primary-btn" onClick={copyShare}>
                Copy
              </button>
            </div>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setShowShare(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Are you absolutely sure?</h3>
            <p className="modal-subtitle">
              This will permanently delete the quiz. This action cannot be undone.
            </p>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setShowDelete(false)}>
                Cancel
              </button>
              <button className="danger-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
