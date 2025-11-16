// src/components/QuizDetailPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function QuizDetailPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [rawQuiz, setRawQuiz] = useState(null); // raw data from backend
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showAnswers, setShowAnswers] = useState(true);

  // action modals
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // ===== fetch this quiz from DB using its id =====
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setErr("");

        const token = localStorage.getItem("token");
        if (!token) {
          setErr("You are not logged in.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/questionsets/${id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load quiz");
        }

        console.log("[QuizDetailPage] loaded quiz:", data);
        setRawQuiz(data);
      } catch (e) {
        console.error("Error fetching quiz by id:", e);
        setErr(e.message || "Could not load quiz.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id]);

  // ===== Decide which questions + answers to use =====
  // Prefer ORIGINAL snapshot (originalQuestionsJSON) if available.
  const { title, questions, answers, createdAt, updatedAt } = useMemo(() => {
    if (!rawQuiz) {
      return {
        title: state?.title || "Quiz",
        questions: [],
        answers: [],
        createdAt: null,
        updatedAt: null,
      };
    }

    const result = {
      title: rawQuiz.title || rawQuiz.name || state?.title || "Quiz",
      questions: [],
      answers: [],
      createdAt: rawQuiz.createdAt || null,
      updatedAt: rawQuiz.updatedAt || null,
    };

    let originalQuestions = [];

    // 1) Try to parse originalQuestionsJSON for snapshot
    if (rawQuiz.originalQuestionsJSON) {
      try {
        const parsed = JSON.parse(rawQuiz.originalQuestionsJSON);

        if (Array.isArray(parsed)) {
          originalQuestions = parsed;
        } else if (Array.isArray(parsed.questions)) {
          originalQuestions = parsed.questions;
        }
      } catch (e) {
        console.warn(
          "[QuizDetailPage] failed to parse originalQuestionsJSON:",
          e.message
        );
      }
    }

    // 2) Fallback to current joined questions if snapshot is empty
    let rawQuestions = [];
    if (originalQuestions.length) {
      rawQuestions = originalQuestions;
    } else if (Array.isArray(rawQuiz.questions)) {
      rawQuestions = rawQuiz.questions;
    } else if (Array.isArray(rawQuiz?.data?.questions)) {
      rawQuestions = rawQuiz.data.questions;
    }

    // Helper: many schemas store actual question in q.question_id
    const getSource = (q) => {
      if (
        q &&
        typeof q === "object" &&
        q.question_id &&
        typeof q.question_id === "object"
      ) {
        return q.question_id;
      }
      return q;
    };

    // 3) Normalize into text + answer arrays
    const questions = rawQuestions.map((q) => {
      const src = getSource(q);

      if (src && typeof src === "object") {
        return (
          src.questionText ||
          src.text || // from QuestionNew
          src.prompt ||
          src.question ||
          src.title ||
          ""
        );
      }
      if (typeof src === "string") return src;
      return "";
    });

    const answers =
      rawQuestions.map((q) => {
        const src = getSource(q);

        if (!src || typeof src !== "object") return "";

        // 1) Direct answer fields (add correctText for your schema)
        let base =
          src.correctAnswer ||
          src.answer ||
          src.solution ||
          src.correct ||
          src.correctOption ||
          src.correctText || // <--- from QuestionNew
          "";

        if (base) return base;

        // 2) Answers encoded in options array
        if (Array.isArray(src.options) && src.options.length) {
          // 2a) Shape in your schema: { option_text, is_correct }
          const flagged = src.options.find(
            (opt) =>
              opt?.is_correct === true || // <--- from QuestionNew
              opt?.isCorrect === true ||
              opt?.correct === true ||
              opt?.answer === true
          );
          if (flagged) {
            return (
              flagged.option_text ||
              flagged.text ||
              flagged.label ||
              (typeof flagged === "string" ? flagged : "")
            );
          }

          // 2b) Fallback: index based
          if (
            typeof src.correctOptionIndex === "number" &&
            src.correctOptionIndex >= 0 &&
            src.correctOptionIndex < src.options.length
          ) {
            const opt = src.options[src.correctOptionIndex];
            return opt.option_text || opt.text || opt.label || String(opt);
          }
        }

        // Nothing found
        return "";
      }) || [];

    result.questions = questions;
    result.answers = answers;

    return result;
  }, [rawQuiz, state?.title]);

  const shareUrl = `${window.location.origin}/dashboard/quiz/${id}`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Link copied to clipboard");
    }
  };

  // ✅ delete quiz in DB
  const handleDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You are not logged in.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/questionsets/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || "Failed to delete quiz");
      }

      alert("Quiz deleted");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      alert(e.message || "Could not delete quiz.");
    }
  };

  return (
    <section>
      {/* Header + actions */}
      <div className="detail-header">
        <button className="secondary-btn back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="detail-heading">
          <h1 className="feed-title">{title || "Quiz"}</h1>
          <p className="feed-subtitle">
            {questions.length} questions · Created:{" "}
            {formatDateTime(createdAt) || "—"} · Last updated:{" "}
            {formatDateTime(updatedAt) || "—"}
          </p>
        </div>

        <div className="detail-actions">
          <button
            className="danger-btn"
            onClick={() => setShowDelete(true)}
            aria-label="Delete quiz"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Loading / error states */}
      {loading && <p>Loading quiz…</p>}
      {!loading && err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* Available Questions */}
          <div className="panel">
            <div className="panel__header">
              <h3>Available Questions</h3>
            </div>
            <ul className="question-list">
              {questions.map((q, idx) => (
                <li key={idx} className="question-row">
                  <span className="q-index">{idx + 1}.</span>
                  <span className="q-text">{q}</span>
                  <button className="kebab" aria-label="More actions">
                    ⋮
                  </button>
                </li>
              ))}
              {questions.length === 0 && (
                <li className="question-row">
                  <span className="q-text">
                    No questions were stored for this quiz.
                  </span>
                </li>
              )}
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
                {answers.map((a, idx) => (
                  <li key={idx} className="question-row">
                    <span className="q-index">{idx + 1}.</span>
                    <span className="q-text">
                      {a || "(No answer stored for this question)"}
                    </span>
                    <button className="kebab" aria-label="More actions">
                      ⋮
                    </button>
                  </li>
                ))}
                {answers.length === 0 && (
                  <li className="question-row">
                    <span className="q-text">
                      No answers were stored for this quiz.
                    </span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ===== Modals (same UI as before) ===== */}

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
              <button
                className="export-item"
                onClick={() => alert("Export questions (stub)")}
              >
                <div className="export-icon">📄</div>
                <div className="export-body">
                  <div className="export-title">Export pdf questions</div>
                  <div className="export-desc">
                    Download the questions in PDF format. With your logo and
                    colors.
                  </div>
                </div>
              </button>
              <button
                className="export-item"
                onClick={() => alert("Export answers (stub)")}
              >
                <div className="export-icon">📄</div>
                <div className="export-body">
                  <div className="export-title">Export pdf Answers</div>
                  <div className="export-desc">
                    Download the questions in PDF format. With your logo and
                    colors.
                  </div>
                </div>
              </button>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => setShowExport(false)}
              >
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
              <button
                className="secondary-btn"
                onClick={() => setShowShare(false)}
              >
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
              This will permanently delete the quiz. This action cannot be
              undone.
            </p>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => setShowDelete(false)}
              >
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
