import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import emptyImg from "../assets/empty_quiz.png";
import { deleteQuiz, updateQuiz } from "../services/api";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const formatUpdatedTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function QuizzesPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Get search query from parent layout
  const { searchQuery } = useOutletContext() || { searchQuery: "" };
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isDeleting, setIsDeleting] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [updateError, setUpdateError] = useState("");

  useEffect(() => {
    document.body.classList.add("hide-sidebar");
    return () => document.body.classList.remove("hide-sidebar");
  }, []);

  useEffect(() => {
    const loadQuizzes = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.log("[QuizzesPage] No token in localStorage.");
          setQuizzes([]);
          return;
        }

        const res = await fetch(`${API_BASE}/api/questionsets/mine`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        console.log("[QuizzesPage] raw response:", data);

        if (!res.ok) {
          console.error(
            "[QuizzesPage] API error:",
            data?.message || res.status
          );
          setQuizzes([]);
          return;
        }

        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (Array.isArray(data.mySets)) {
          list = data.mySets;
        } else if (Array.isArray(data.questionSets)) {
          list = data.questionSets;
        } else if (Array.isArray(data.sets)) {
          list = data.sets;
        } else if (Array.isArray(data.data)) {
          list = data.data;
        } else if (data && typeof data === "object") {
          const firstArrayKey = Object.keys(data).find((k) =>
            Array.isArray(data[k])
          );
          if (firstArrayKey) {
            list = data[firstArrayKey];
          }
        }

        console.log("[QuizzesPage] normalized list:", list);
        setQuizzes(list || []);
      } catch (err) {
        console.error("[QuizzesPage] Failed to load quizzes:", err);
        setQuizzes([]);
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, []);

  // Filter quizzes based on search query
  const filteredQuizzes = useMemo(() => {
    if (!searchQuery.trim()) return quizzes;
    
    const query = searchQuery.toLowerCase();
    return quizzes.filter((q) => {
      const title = (q.title || q.name || "").toLowerCase();
      const description = (q.description || "").toLowerCase();
      return title.includes(query) || description.includes(query);
    });
  }, [quizzes, searchQuery]);

  const handleEditClick = (quiz) => {
    setEditingId(quiz._id || quiz.id);
    setEditTitle(quiz.title || quiz.name || "");
    setEditDescription(quiz.description || "");
    setOpenMenuId(null);
    setUpdateError("");
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setUpdateError("Quiz title cannot be empty");
      return;
    }

    try {
      await updateQuiz(editingId, {
        title: editTitle,
        description: editDescription,
      });

      // Update local state
      setQuizzes(
        quizzes.map((q) => {
          const qId = q._id || q.id;
          if (qId === editingId) {
            return { ...q, title: editTitle, description: editDescription };
          }
          return q;
        })
      );

      setEditingId(null);
      setEditTitle("");
      setEditDescription("");
      setUpdateError("");
    } catch (err) {
      console.error("Error updating quiz:", err);
      setUpdateError(err.message || "Failed to update quiz");
    }
  };

  const handleDeleteClick = (quizId) => {
    setIsDeleting(quizId);
    setShowDeleteConfirm(true);
    setOpenMenuId(null);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteQuiz(isDeleting);

      // Remove from local state
      setQuizzes(quizzes.filter((q) => (q._id || q.id) !== isDeleting));

      setShowDeleteConfirm(false);
      setIsDeleting(null);
      setDeleteError("");
    } catch (err) {
      console.error("Error deleting quiz:", err);
      setDeleteError(err.message || "Failed to delete quiz");
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setIsDeleting(null);
    setDeleteError("");
  };

  const handleMenuToggle = (quizId, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === quizId ? null : quizId);
  };

  // While loading
  if (loading) {
    return (
      <section className="dashboard-feed">
        <header className="feed-header feed-header--center-with-cta">
          <div className="feed-header-main">
            <h1 className="feed-title">Welcome to Quiz Dashboard</h1>
            <p className="feed-subtitle">
              View and manage the quizzes you have saved.
            </p>
          </div>
          <div className="feed-cta">
            <button
              className="primary-btn"
              onClick={() => navigate("/dashboard/new")}
            >
              Create New Quiz
            </button>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="dashboard-feed">
      {/* Header: text centered, button on the right */}
      <header className="feed-header feed-header--center-with-cta">
        <div className="feed-header-main">
          <h1 className="feed-title">Welcome to Quiz Dashboard</h1>
          <p className="feed-subtitle">
            View and manage the quizzes you have saved.
          </p>
        </div>

        <div className="feed-cta">
          <button
            className="primary-btn"
            onClick={() => navigate("/dashboard/new")}
          >
            Create New Quiz
          </button>
        </div>
      </header>

      {/* Show search info if searching */}
      {searchQuery.trim() && (
        <div className="search-info">
          <p className="search-info__text">
            {filteredQuizzes.length > 0 
              ? `Found ${filteredQuizzes.length} quiz${filteredQuizzes.length !== 1 ? 'es' : ''} matching "${searchQuery}"`
              : `No quizzes found matching "${searchQuery}"`
            }
          </p>
        </div>
      )}

      {/* If no quizzes after filtering */}
      {filteredQuizzes.length === 0 ? (
        <div className="empty-wrapper">
          <div className="empty-state">
            <img
              src={emptyImg}
              alt="No quizzes"
              className="empty-state__img"
            />
            <h3 className="empty-state__title">
              {searchQuery.trim() ? "No matches found" : "No quiz available"}
            </h3>
            <p className="empty-state__desc">
              {searchQuery.trim() 
                ? `Try a different search term or create a new quiz.`
                : "Currently, there are no quizzes. Please add new quiz."
              }
            </p>

            <button
              className="primary-btn"
              onClick={() => navigate("/dashboard/new")}
            >
              Add New Quiz
            </button>
          </div>
        </div>
      ) : (
        <ul className="quiz-feed">
          {filteredQuizzes.map((q) => {
            const id = q._id || q.id;
            const title = q.title || q.name || "Untitled quiz";
            const total =
              q.questionCount ||
              q.totalQuestions ||
              (Array.isArray(q.questions) ? q.questions.length : 0);
            const updated = q.updatedAt || q.createdAt;
            const updatedLabel = formatUpdatedTime(updated);

            // Show edit form if this quiz is being edited
            if (editingId === id) {
              return (
                <li key={id} className="quiz-item-card edit-mode">
                  <div className="edit-form">
                    <h3>Edit Quiz Name</h3>
                    {updateError && <p className="error-msg">{updateError}</p>}
                    <input
                      type="text"
                      placeholder="Quiz Title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="edit-input"
                    />
                    <textarea
                      placeholder="Quiz Description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="edit-textarea"
                    />
                    <div className="edit-actions">
                      <button
                        className="primary-btn"
                        onClick={handleSaveEdit}
                      >
                        Save
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setEditingId(null);
                          setUpdateError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li key={id} className="quiz-item-card">
                <div
                  className="quiz-item-main"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    navigate(`/dashboard/quiz/${id}`, {
                      state: { title, total, updatedAt: updated },
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      navigate(`/dashboard/quiz/${id}`, {
                        state: { title, total, updatedAt: updated },
                      });
                    }
                  }}
                >
                  <h3 className="quiz-item-title">{title}</h3>
                  <p className="quiz-item-summary">
                    {q.description || "Questions generated from your sources."}
                  </p>
                  <div className="quiz-item-meta">
                    <span className="badge">{total} Questions</span>
                    {updatedLabel && (
                      <span className="badge soft">
                        Last updated: {updatedLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hover-hint" aria-hidden="true">
                  Click to view
                </div>
                <div className="quiz-menu-container">
                  <button
                    className="kebab"
                    aria-label="More actions"
                    onClick={(e) => handleMenuToggle(id, e)}
                  >
                    ⋮
                  </button>
                  {openMenuId === id && (
                    <div className="quiz-dropdown-menu">
                      <button
                        className="menu-item edit"
                        onClick={() => handleEditClick(q)}
                      >
                         Edit Quiz Name
                      </button>
                      <button
                        className="menu-item delete"
                        onClick={() => handleDeleteClick(id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Quiz</h2>
            <p>Are you sure you want to delete this quiz? This action cannot be undone.</p>
            {deleteError && <p className="error-msg">{deleteError}</p>}
            <div className="modal-actions">
              <button
                className="danger-btn"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
              <button
                className="secondary-btn"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}