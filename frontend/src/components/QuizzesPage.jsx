import React from "react";
import { useNavigate } from "react-router-dom";
import emptyImg from "../assets/empty_quiz.png";

// TODO: replace this with real data from API/store
const mockQuizzes = [
//   Leave [] to see the empty state
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
  const quizzes = mockQuizzes; // swap to real data later

  return (
    <section>
      <header className="feed-header">
        <div>
          <h1 className="feed-title">Welcome to Quiz Dashboard</h1>
          <p className="feed-subtitle">
            Manage your quiz questions here. You can edit and delete questions.
          </p>
        </div>
        <button
          className="primary-btn feed-cta"
          onClick={() => navigate("/dashboard/new")}
        >
          Create New Quiz
        </button>
      </header>

      {/* Empty state vs list */}
      {!quizzes.length ? (
        <div className="empty-state" style={{ marginTop: "1rem" }}>
          <img src={emptyImg} alt="No quizzes" className="empty-state__img" />
          <h3 className="empty-state__title">No quiz available</h3>
          <p className="empty-state__desc">
            Currently, there are no quizzes. Please add a new quiz.
          </p>
        </div>
      ) : (
        <ul className="quiz-feed">
          {quizzes.map((q) => (
            <li key={q.id} className="quiz-item-card">
              <div
                className="quiz-item-main"
                onClick={() =>
                  navigate(`/dashboard/quiz/${q.id}`, { state: q })
                }
              >
                <h3 className="quiz-item-title">{q.title}</h3>
                <p className="quiz-item-summary">{q.summary}</p>
                <div className="quiz-item-meta">
                  <span className="badge">{q.total} Questions</span>
                  <span className="badge soft">
                    Last Update : {q.updatedAgo}
                  </span>
                </div>
              </div>
              <button className="kebab" aria-label="More actions">
                ⋮
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
            className="primary-btn"
            onClick={() => navigate("/dashboard/new")}
          >
            Add New Quiz
          </button>
    </section>
  );
}
