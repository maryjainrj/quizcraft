import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";

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
  
  // Get search query from DashboardLayout
  const { searchQuery } = useOutletContext() || { searchQuery: "" };

  const [rawQuiz, setRawQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showAnswers, setShowAnswers] = useState(true);

  // action modals
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

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

    let rawQuestions = [];
    if (originalQuestions.length) {
      rawQuestions = originalQuestions;
    } else if (Array.isArray(rawQuiz.questions)) {
      rawQuestions = rawQuiz.questions;
    } else if (Array.isArray(rawQuiz?.data?.questions)) {
      rawQuestions = rawQuiz.data.questions;
    }

    const questions = rawQuestions.map((q) => {
      if (q && typeof q === "object") {
        return (
          q.questionText ||
          q.text ||
          q.prompt ||
          q.question ||
          q.title ||
          ""
        );
      }
      if (typeof q === "string") return q;
      return "";
    });

    const answers =
      rawQuestions.map((q) => {
        if (q && typeof q === "object") {
          return (
            q.correctAnswer ||
            q.answer ||
            q.solution ||
            q.correct ||
            q.correctOption ||
            ""
          );
        }
        return "";
      }) || [];

    result.questions = questions;
    result.answers = answers;

    return result;
  }, [rawQuiz, state?.title]);

  // Filter questions and answers based on search from parent layout
  const { filteredQuestions, filteredAnswers } = useMemo(() => {
    if (!searchQuery.trim()) {
      return {
        filteredQuestions: questions.map((q, idx) => ({ text: q, originalIdx: idx })),
        filteredAnswers: answers.map((a, idx) => ({ text: a, originalIdx: idx })),
      };
    }

    const query = searchQuery.toLowerCase();
    const matched = new Set();

    // Check which questions or answers match
    questions.forEach((q, idx) => {
      const questionMatch = q.toLowerCase().includes(query);
      const answerMatch = answers[idx]?.toLowerCase().includes(query);
      
      if (questionMatch || answerMatch) {
        matched.add(idx);
      }
    });

    const filteredQ = [];
    const filteredA = [];

    matched.forEach(idx => {
      filteredQ.push({ text: questions[idx], originalIdx: idx });
      filteredA.push({ text: answers[idx], originalIdx: idx });
    });

    return {
      filteredQuestions: filteredQ,
      filteredAnswers: filteredA,
    };
  }, [questions, answers, searchQuery]);

  // Highlight matching text
  const highlightText = (text, query) => {
    if (!query.trim() || !text) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, idx) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={idx} className="highlight">{part}</mark>
        : part
    );
  };

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

      {/* Search results info */}
      {searchQuery.trim() && !loading && !err && (
        <div className="search-info">
          <p className="search-info__text">
            {filteredQuestions.length > 0 
              ? `Found ${filteredQuestions.length} matching question${filteredQuestions.length !== 1 ? 's' : ''} for "${searchQuery}"`
              : `No questions match "${searchQuery}"`
            }
          </p>
        </div>
      )}

      {/* Loading / error states */}
      {loading && <p>Loading quiz…</p>}
      {!loading && err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* Available Questions */}
          <div className="panel">
            <div className="panel__header">
              <h3>Available Questions</h3>
              <span className="panel__count">
                {searchQuery.trim() 
                  ? `${filteredQuestions.length} of ${questions.length}`
                  : questions.length
                }
              </span>
            </div>
            <ul className="question-list">
              {filteredQuestions.map((item) => (
                <li key={item.originalIdx} className="question-row">
                  <span className="q-index">{item.originalIdx + 1}.</span>
                  <span className="q-text">
                    {highlightText(item.text, searchQuery)}
                  </span>
                  <button className="kebab" aria-label="More actions">
                    ⋮
                  </button>
                </li>
              ))}
              {filteredQuestions.length === 0 && searchQuery.trim() && (
                <li className="question-row">
                  <span className="q-text">
                    No questions match your search "{searchQuery}"
                  </span>
                </li>
              )}
              {questions.length === 0 && !searchQuery.trim() && (
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
              <div className="panel__header-right">
                <span className="panel__count">
                  {searchQuery.trim() 
                    ? `${filteredAnswers.length} of ${answers.length}`
                    : answers.length
                  }
                </span>
                <button
                  className="chevron"
                  aria-label="Toggle answers"
                  onClick={() => setShowAnswers((s) => !s)}
                >
                  {showAnswers ? "▾" : "▸"}
                </button>
              </div>
            </div>

            {showAnswers && (
              <ul className="question-list">
                {filteredAnswers.map((item) => (
                  <li key={item.originalIdx} className="question-row">
                    <span className="q-index">{item.originalIdx + 1}.</span>
                    <span className="q-text">
                      {item.text 
                        ? highlightText(item.text, searchQuery)
                        : "(No answer stored for this question)"
                      }
                    </span>
                    <button className="kebab" aria-label="More actions">
                      ⋮
                    </button>
                  </li>
                ))}
                {filteredAnswers.length === 0 && searchQuery.trim() && (
                  <li className="question-row">
                    <span className="q-text">
                      No answers match your search "{searchQuery}"
                    </span>
                  </li>
                )}
                {answers.length === 0 && !searchQuery.trim() && (
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