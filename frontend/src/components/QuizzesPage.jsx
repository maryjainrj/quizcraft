import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import emptyImg from "../assets/empty_quiz.png";

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

  if (loading) {
    return (
      <section className="dashboard-feed">
        <header className="feed-header">
          <div>
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
      <header className="feed-header">
        <div>
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
                <button className="kebab" aria-label="More actions">
                  ⋮
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}