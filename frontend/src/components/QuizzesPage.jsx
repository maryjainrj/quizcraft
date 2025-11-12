// src/components/QuizzesPage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import emptyImg from "../assets/empty_quiz.png";

const mockQuizzes = [
  {
    id: "1",
    title: "Entry-Level Accounting Professional Seeking Opportunities",
    summary:
      "Motivated B.Com graduate pursuing CS qualification, skilled in financial reporting, TALLY, and problem-solving...",
    total: 30,
    updatedAgo: "2 days ago",
  },
  {
    id: "2",
    title: "World History – Renaissance & Reformation",
    summary:
      "Key figures, timelines and transformations across Europe including humanism, art, science, and religious movements...",
    total: 18,
    updatedAgo: "5 days ago",
  },
];

export default function QuizzesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Hide the sidebar on this page and show header brand
    document.body.classList.add("hide-sidebar");
    return () => document.body.classList.remove("hide-sidebar");
  }, []);

  const quizzes = mockQuizzes;

  return (
    <section>
      <header className="feed-header">
        <div>
          <h1 className="feed-title">Welcome to Quiz Dashboard</h1>
        </div>
        <button
          className="primary-btn feed-cta"
          onClick={() => navigate("/dashboard/new")}
        >
          Create New Quiz
        </button>
      </header>

      {!quizzes.length ? (
        <div className="empty-state" style={{ marginTop: "1rem" }}>
          <img src={emptyImg} alt="No quizzes" className="empty-state__img" />
          <h3 className="empty-state__title">No quiz available</h3>
          <p className="empty-state__desc">
            Currently, there are no quizzes. Please add a new quiz.
          </p>
          <button
          className="primary-btn feed-cta"
          onClick={() => navigate("/dashboard/new")}
        >
          Add New Quiz
        </button>
        </div>
      ) : (
        <ul className="quiz-feed">
          {quizzes.map((q) => (
            <li key={q.id} className="quiz-item-card">
              <div
                className="quiz-item-main"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/quiz/${q.id}`, { state: q })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate(`/dashboard/quiz/${q.id}`, { state: q });
                  }
                }}
              >
                <h3 className="quiz-item-title">{q.title}</h3>
                <p className="quiz-item-summary">{q.summary}</p>
                <div className="quiz-item-meta">
                  <span className="badge">{q.total} Questions</span>
                  <span className="badge soft">Last Update : {q.updatedAgo}</span>
                </div>
              </div>

              {/* hover hint */}
              <div className="hover-hint" aria-hidden="true">Click to view</div>

              <button className="kebab" aria-label="More actions">⋮</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
