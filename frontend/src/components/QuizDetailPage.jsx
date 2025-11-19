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

  // edit mode - whole quiz
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState([]);
  const [editedAnswers, setEditedAnswers] = useState([]);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // edit mode - single question
  const [editingQuestionIdx, setEditingQuestionIdx] = useState(null);
  const [singleEditQuestion, setSingleEditQuestion] = useState("");
  const [singleEditAnswer, setSingleEditAnswer] = useState("");
  const [singleEditError, setSingleEditError] = useState("");
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

    // 2) Prefer snapshot (reflects saved edits), fallback to populated DB
    let rawQuestions = [];
    let source = "none";
    if (originalQuestions.length) {
      rawQuestions = originalQuestions;
      source = "snapshot";
    } else if (Array.isArray(rawQuiz.questions) && rawQuiz.questions.length > 0) {
      rawQuestions = rawQuiz.questions;
      source = "populated-db";
    } else if (Array.isArray(rawQuiz?.data?.questions)) {
      rawQuestions = rawQuiz.data.questions;
      source = "raw-data-questions";
    }

    console.log(`[QuizDetailPage] Source=${source} Raw questions count=`, rawQuestions?.length || 0);

    // Helper to map letter answers (A, B, C, D) to actual option text
    const mapAnswerToText = (q) => {
      if (!q || typeof q !== "object") return "";

      // If populated from QuestionNew (backend populated data)
      if (q.question_id && typeof q.question_id === "object") {
        const qi = q.question_id;
        if (qi.type === "mcq" && Array.isArray(qi.options) && qi.options.length) {
          const correct = qi.options.find(o => o?.is_correct);
          return correct?.option_text || "";
        }
        return qi.correctText || "";
      }

      // Get the raw answer value from various possible fields
      let rawAnswer = 
        q.correctAnswer ||
        q.answer ||
        q.solution ||
        q.correct ||
        q.correctOption ||
        q.answerText ||
        q.correctAnswerText ||
        "";

      // If this is a multiple-choice with options array and answer is a letter
      if (Array.isArray(q.options) && q.options.length > 0 && rawAnswer) {
        const answerStr = String(rawAnswer).trim().toUpperCase();
        
        // Map letter to index (A=0, B=1, C=2, D=3)
        const letterToIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        
        if (letterToIndex[answerStr] !== undefined) {
          const index = letterToIndex[answerStr];
          if (q.options[index]) {
            console.log(`[QuizDetailPage] Mapped answer "${answerStr}" to option text: "${q.options[index]}"`);
            return q.options[index];
          }
        }
        
        // If answer is numeric index
        const numIndex = parseInt(answerStr);
        if (!isNaN(numIndex) && q.options[numIndex]) {
          return q.options[numIndex];
        }
      }

      // Return raw answer for other types (true-false, fill-in-blank)
      return rawAnswer;
    };

    // 3) Normalize into text + answer arrays
    const questions = rawQuestions.map((q) => {
      // If populated from QuestionSet -> { question_id: { text, ... } }
      if (q && q.question_id && typeof q.question_id === "object") {
        return q.question_id.text || q.question_id.question || "";
      }
      // If shape like { questionText: "...", correctAnswer: "..." }
      if (q && typeof q === "object") {
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

    let answers = rawQuestions.map((q, idx) => {
      const answer = mapAnswerToText(q);
      
      // Debug log to see what we're extracting
      if (!answer) {
        console.log(`[QuizDetailPage] No answer found for question ${idx}:`, q);
      } else {
        console.log(`[QuizDetailPage] Answer ${idx}:`, answer);
      }
      
      return answer;
    });

    // 3b) Fallback: if many answers missing, try alternate source
    const missingCount = answers.filter(a => !a).length;
    if (missingCount === answers.length) {
      // All answers missing; try alternate source
      let fallbackRaw = null;
      if (source === "populated-db" && originalQuestions.length) {
        fallbackRaw = originalQuestions;
        console.log("[QuizDetailPage] Fallback to snapshot for answers");
      } else if (source !== "populated-db" && Array.isArray(rawQuiz.questions) && rawQuiz.questions.length) {
        fallbackRaw = rawQuiz.questions;
        console.log("[QuizDetailPage] Fallback to populated DB for answers");
      }
      if (fallbackRaw) {
        answers = fallbackRaw.map((q) => mapAnswerToText(q));
      }
    }

    console.log("[QuizDetailPage] Extracted questions:", questions);
    console.log("[QuizDetailPage] Extracted answers:", answers);

    result.questions = questions;
    result.answers = answers;

    return result;
  }, [rawQuiz, state?.title]);

  // Initialize edited values when questions/answers load
  useEffect(() => {
    if (rawQuiz && !isEditMode) {
      setEditedTitle(rawQuiz.title || rawQuiz.name || "");
      setEditedDescription(rawQuiz.description || "");
      setEditedQuestions(questions);
      setEditedAnswers(answers);
    }
  }, [questions, answers, rawQuiz, isEditMode]);

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

  // Enter edit mode
  const handleEnterEditMode = () => {
    setIsEditMode(true);
    setSaveError("");
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setSaveError("");
  };

  // Save all changes
  const handleSaveEdit = async () => {
    if (!editedTitle.trim()) {
      setSaveError("Quiz title cannot be empty");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");
      const token = localStorage.getItem("token");

      if (!token) {
        setSaveError("You are not logged in.");
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
      alert("Quiz updated successfully!");
    } catch (e) {
      console.error("Error saving quiz:", e);
      setSaveError(e.message || "Failed to save changes");
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
    setSingleEditError("");
  };

  const handleSaveSingleQuestion = async () => {
    if (!singleEditQuestion.trim()) {
      setSingleEditError("Question cannot be empty");
      return;
    }

    try {
      setIsSavingSingleQuestion(true);
      setSingleEditError("");
      const token = localStorage.getItem("token");
      if (!token) {
        setSingleEditError("You are not logged in.");
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
      alert("Question updated successfully!");
    } catch (e) {
      setSingleEditError(e.message || "Failed to save question");
    } finally {
      setIsSavingSingleQuestion(false);
    }
  };

  const handleCancelSingleEdit = () => {
    setEditingQuestionIdx(null);
    setSingleEditQuestion("");
    setSingleEditAnswer("");
    setSingleEditError("");
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
          {!isEditMode && (
            <button
              className="primary-btn"
              onClick={handleEnterEditMode}
              aria-label="Edit quiz"
            >
              Edit Quiz
            </button>
          )}
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
              {saveError && <p className="error-msg">{saveError}</p>}
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
                      {singleEditError && <p className="error-msg">{singleEditError}</p>}
                      
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
                              ✎
                            </button>
                            <button 
                              className="action-btn delete-btn"
                              aria-label="Delete question"
                              title="Delete"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Options - Show from answers if available */}
                    {!isEditMode && answers[idx] && (
                      <div className="options-container">
                        <div className="option">
                          <span className="option-label">Correct Answer:</span>
                          <span className="option-text">{answers[idx]}</span>
                        </div>
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
          </div>

          {/* View Answers */}
          <div className="panel">
            <div className="panel__header">
              <h3>{isEditMode ? "Edit Answers" : "View Answers"}</h3>
              <button
                className="chevron"
                aria-label="Toggle answers"
                onClick={() => setShowAnswers((s) => !s)}
              >
                {showAnswers ? "▾" : "▸"}
              </button>
            </div>

            {showAnswers && !isEditMode && (
              <div className="answers-container">
                {(isEditMode ? editedAnswers : answers).map((a, idx) => (
                  <div key={idx} className="answer-item">
                    <span className="answer-number">{idx + 1}.</span>
                    <span className="answer-text">
                      {a || "(No answer stored for this question)"}
                    </span>
                  </div>
                ))}
                {(isEditMode ? editedAnswers : answers).length === 0 && (
                  <div className="empty-answers">
                    <span>No answers were stored for this quiz.</span>
                  </div>
                )}
              </div>
            )}

            {showAnswers && isEditMode && (
              <ul className="question-list">
                {(isEditMode ? editedAnswers : answers).map((a, idx) => (
                  <li key={idx} className="question-row edit-mode">
                    <span className="q-index">{idx + 1}.</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={a}
                        onChange={(e) => handleUpdateAnswer(idx, e.target.value)}
                        className="edit-question-input"
                      />
                    ) : (
                      <span className="q-text">
                        {a || "(No answer stored for this question)"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Edit Mode Actions */}
          {isEditMode && (
            <div className="edit-mode-actions">
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
  