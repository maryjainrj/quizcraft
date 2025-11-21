// src/components/QuizDetailPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useToast } from "./ToastProvider";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

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
  const toast = useToast();

  const [rawQuiz, setRawQuiz] = useState(null); // raw data from backend
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showAnswers, setShowAnswers] = useState(true);

  // action modals
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDeleteQuestion, setShowDeleteQuestion] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);

  // edit mode - whole quiz
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState([]);
  const [editedAnswers, setEditedAnswers] = useState([]);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // edit mode - single question
  const [editingQuestionIdx, setEditingQuestionIdx] = useState(null);
  const [singleEditQuestion, setSingleEditQuestion] = useState("");
  const [singleEditAnswer, setSingleEditAnswer] = useState("");
  const [isSavingSingleQuestion, setIsSavingSingleQuestion] = useState(false);

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

  // ===== Decide which questions to use =====
  // Prefer ORIGINAL snapshot (originalQuestionsJSON) if available,
  // so you see exactly what was generated at creation time.
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

    // 3) Normalize into text + answer arrays
    const questions = rawQuestions.map((q) => {
      // If shape like { questionText: "...", correctAnswer: "..." }
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
      // If it is a plain string
      if (typeof q === "string") return q;
      return "";
    });

    const answers =
      rawQuestions.map((q) => {
        if (q && typeof q === "object") {
          // For multiple-choice questions, find the correct answer from options
          if (q.type === "multiple-choice" && Array.isArray(q.options)) {
            const correctOption = q.options.find(opt => opt.is_correct === true);
            if (correctOption && correctOption.option_text) {
              return String(correctOption.option_text);
            }
          }
          
          // For true-false questions
          if (q.type === "true-false" && q.correct_answer) {
            return String(q.correct_answer);
          }
          
          // For fill-in-blank or other formats
          const answer = q.correctAnswer ||
            q.correct_answer ||
            q.answer ||
            q.solution ||
            q.correct ||
            q.correctOption ||
            "";
          return String(answer);
        }
        return "";
      }) || [];

    result.questions = questions;
    result.answers = answers;

    // Debug: Log to check data structure
    console.log('[QuizDetailPage] rawQuiz:', rawQuiz);
    console.log('[QuizDetailPage] rawQuestions length:', rawQuestions.length);
    if (rawQuestions.length > 0) {
      console.log('[QuizDetailPage] Sample question object:', JSON.stringify(rawQuestions[0], null, 2));
      console.log('[QuizDetailPage] Extracted questions:', questions.slice(0, 2));
      console.log('[QuizDetailPage] Extracted answers:', answers.slice(0, 2));
    }

    return result;
  }, [rawQuiz, state?.title]);

  const shareUrl = `${window.location.origin}/dashboard/quiz/${id}`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Link copied to clipboard!");
    }
  };

  // ✅ delete quiz in DB instead of front-end only
  const handleDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You are not logged in.");
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

      toast.success("Quiz deleted successfully!");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error(e.message || "Could not delete quiz.");
    }
  };

  // Enter edit mode
  const handleEnterEditMode = () => {
    setEditedTitle(title);
    setEditedDescription(rawQuiz?.description || "");
    setEditedQuestions([...questions]);
    setEditedAnswers([...answers]);
    setIsEditMode(true);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  // Save all changes
  const handleSaveEdit = async () => {
    if (!editedTitle.trim()) {
      toast.error("Quiz title cannot be empty");
      return;
    }

    try {
      setIsSaving(true);
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("You are not logged in.");
        return;
      }

      // Create updated questions array with both question and answer
      const updatedQuestionsData = editedQuestions.map((q, idx) => ({
        questionText: q,
        correctAnswer: editedAnswers[idx] || "",
      }));

      console.log("[QuizDetailPage] Saving questions data:", updatedQuestionsData);

      // Save quiz metadata (title, description) and questions
      const metaRes = await fetch(`${API_BASE}/api/questionsets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editedTitle,
          description: editedDescription,
          questions: updatedQuestionsData,
        }),
      });

      const metaData = await metaRes.json().catch(() => null);
      if (!metaRes.ok) {
        throw new Error(metaData?.message || "Failed to update quiz");
      }

      // Update rawQuiz with new metadata and questions
      setRawQuiz((prev) => ({
        ...prev,
        title: editedTitle,
        description: editedDescription,
        originalQuestionsJSON: JSON.stringify(updatedQuestionsData),
      }));

      setIsEditMode(false);
      toast.success("Quiz updated successfully!");
    } catch (e) {
      console.error("Error saving quiz:", e);
      toast.error(e.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Update question text
  const handleUpdateQuestion = (idx, newText) => {
    const updated = [...editedQuestions];
    updated[idx] = newText;
    setEditedQuestions(updated);
  };

  // Update answer text
  const handleUpdateAnswer = (idx, newText) => {
    const updated = [...editedAnswers];
    updated[idx] = newText;
    setEditedAnswers(updated);
  };

  // Single question edit handlers
  const handleEditSingleQuestion = (idx) => {
    setEditingQuestionIdx(idx);
    setSingleEditQuestion(questions[idx]);
    setSingleEditAnswer(answers[idx] || "");
  };

  const handleSaveSingleQuestion = async () => {
    if (!singleEditQuestion.trim()) {
      toast.error("Question cannot be empty");
      return;
    }

    try {
      setIsSavingSingleQuestion(true);
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You are not logged in.");
        return;
      }

      // Build updated arrays based on current displayed questions/answers
      const updatedQuestionsArr = [...questions];
      updatedQuestionsArr[editingQuestionIdx] = singleEditQuestion;

      const updatedAnswersArr = [...answers];
      updatedAnswersArr[editingQuestionIdx] = singleEditAnswer;

      // Create payload in snapshot-friendly form
      const updatedQuestionsData = updatedQuestionsArr.map((q, idx) => ({
        questionText: q,
        correctAnswer: updatedAnswersArr[idx] || "",
      }));

      // Persist to backend (updates originalQuestionsJSON)
      const res = await fetch(`${API_BASE}/api/questionsets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questions: updatedQuestionsData,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || "Failed to update question");
      }

      // Update local rawQuiz snapshot so UI reflects saved data
      setRawQuiz((prev) => ({
        ...prev,
        originalQuestionsJSON: JSON.stringify(updatedQuestionsData),
      }));

      setEditingQuestionIdx(null);
      toast.success("Question updated successfully!");
    } catch (e) {
      toast.error(e.message || "Failed to save question");
    } finally {
      setIsSavingSingleQuestion(false);
    }
  };

  const handleCancelSingleEdit = () => {
    setEditingQuestionIdx(null);
    setSingleEditQuestion("");
    setSingleEditAnswer("");
  };

  // Handle individual question deletion
  const handleDeleteQuestion = async () => {
    if (questionToDelete === null) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You are not logged in.");
        return;
      }

      const updatedQuestions = questions.filter((_, i) => i !== questionToDelete);
      const updatedAnswers = answers.filter((_, i) => i !== questionToDelete);
      const updatedData = updatedQuestions.map((q, i) => ({
        questionText: q,
        correctAnswer: updatedAnswers[i] || ""
      }));

      const res = await fetch(`${API_BASE}/api/questionsets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: updatedData }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || "Failed to delete question");
      }

      setRawQuiz((prev) => ({
        ...prev,
        originalQuestionsJSON: JSON.stringify(updatedData)
      }));

      setShowDeleteQuestion(false);
      setQuestionToDelete(null);
      toast.success("Question deleted successfully!");
    } catch (e) {
      toast.error(e.message || "Failed to delete question");
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

      {/* Loading / error states */}
      {loading && <p>Loading quiz…</p>}
      {!loading && err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* Edit Mode Header */}
          {isEditMode && (
            <div className="edit-mode-section">
              <h3>Edit Quiz Details</h3>
              <div className="form-group">
                <label>Quiz Title</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="edit-input"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="edit-textarea"
                  placeholder="Optional description"
                />
              </div>
            </div>
          )}

          {/* Available Questions */}
          <div className="quiz-preview-section">
            <h2 className="quiz-preview-title">Questions</h2>
            <div className="questions-container">
              {(isEditMode ? editedQuestions : questions).map((q, idx) => {
                const isSingleEditMode = editingQuestionIdx === idx;

                // Single question edit form
                if (isSingleEditMode) {
                  return (
                    <div key={idx} className="question-card single-edit-mode">
                      <h4 className="single-edit-title">Edit Question {idx + 1}</h4>
                      
                      <div className="form-group">
                        <label>Question</label>
                        <textarea
                          value={singleEditQuestion}
                          onChange={(e) => setSingleEditQuestion(e.target.value)}
                          className="edit-question-input"
                          placeholder="Question text"
                          rows="3"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>Answer</label>
                        <textarea
                          value={singleEditAnswer}
                          onChange={(e) => setSingleEditAnswer(e.target.value)}
                          className="edit-question-input"
                          placeholder="Answer text"
                          rows="2"
                        />
                      </div>

                      <div className="single-edit-actions">
                        <button
                          className="primary-btn"
                          onClick={handleSaveSingleQuestion}
                          disabled={isSavingSingleQuestion}
                        >
                          {isSavingSingleQuestion ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="secondary-btn"
                          onClick={handleCancelSingleEdit}
                          disabled={isSavingSingleQuestion}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                // Normal view mode
                return (
                  <div key={idx} className={`question-card ${isEditMode ? "edit-mode" : ""}`}>
                    <div className="question-card-header">
                      <div className="question-text-wrapper">
                        <span className="question-number">{idx + 1}.</span>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={q}
                            onChange={(e) => handleUpdateQuestion(idx, e.target.value)}
                            className="edit-question-input"
                            placeholder="Question text"
                          />
                        ) : (
                          <span className="question-text">{q}</span>
                        )}
                      </div>
                      <div className="question-actions">
                        {!isEditMode && (
                          <>
                            <button 
                              className="action-btn edit-btn"
                              aria-label="Edit question"
                              onClick={() => handleEditSingleQuestion(idx)}
                              title="Edit"
                            >
                              <FiEdit2 />
                            </button>
                            <button 
                              className="action-btn delete-btn"
                              aria-label="Delete question"
                              title="Delete"
                              onClick={() => {
                                setQuestionToDelete(idx);
                                setShowDeleteQuestion(true);
                              }}
                            >
                              <FiTrash2 />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Show correct answer when not in edit mode */}
                    {!isEditMode && answers[idx] && (
                      <div className="answer-display" style={{ marginTop: "12px", padding: "10px", backgroundColor: "#f0fdf4", borderLeft: "3px solid #22c55e", borderRadius: "4px" }}>
                        <span style={{ fontWeight: "600", color: "#15803d", fontSize: "14px" }}>Correct Answer: </span>
                        <span style={{ color: "#166534" }}>{answers[idx]}</span>
                      </div>
                    )}

                    {/* Edit mode answer field */}
                    {isEditMode && (
                      <div className="options-container">
                        <label>Answer</label>
                        <textarea
                          value={(editedAnswers[idx] || "")}
                          onChange={(e) => handleUpdateAnswer(idx, e.target.value)}
                          className="edit-question-input"
                          placeholder="Answer text"
                          rows="2"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {(isEditMode ? editedQuestions : questions).length === 0 && (
                <div className="empty-questions">
                  <span>No questions were stored for this quiz.</span>
                </div>
              )}
            </div>

            {/* Edit Mode Actions */}
            {isEditMode && (
              <div className="edit-mode-actions" style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button
                  className="primary-btn"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save All Changes"}
                </button>
                <button
                  className="secondary-btn"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Edit Button - Show when not in edit mode */}
            {!isEditMode && (
              <div style={{ marginTop: "20px" }}>
                <button
                  className="primary-btn"
                  onClick={handleEnterEditMode}
                >
                  Edit Quiz
                </button>
              </div>
            )}
          </div>

          {/* View Answers */}
          <div className="panel">
            <div className="panel__header">
              <h3>Answer Key</h3>
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
                {questions.map((q, idx) => (
                  <li key={idx} className="question-row">
                    <span className="q-index">{idx + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: "8px", color: "#4b5563", fontSize: "14px" }}>{q}</div>
                      <div style={{ padding: "8px", backgroundColor: "#f0fdf4", borderRadius: "4px", color: "#166534", fontWeight: "500" }}>
                        {answers[idx] || "(No answer stored)"}
                      </div>
                    </div>
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
                onClick={() => toast.info("Export questions feature coming soon")}
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
                onClick={() => toast.info("Export answers feature coming soon")}
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

      {/* Delete Question Confirm Modal */}
      {showDeleteQuestion && (
        <div className="modal-overlay" onClick={() => setShowDeleteQuestion(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Delete Question?</h3>
            <p className="modal-subtitle">
              Are you sure you want to delete this question? This action cannot be undone.
            </p>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowDeleteQuestion(false);
                  setQuestionToDelete(null);
                }}
              >
                Cancel
              </button>
              <button className="danger-btn" onClick={handleDeleteQuestion}>
                Delete Question
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
