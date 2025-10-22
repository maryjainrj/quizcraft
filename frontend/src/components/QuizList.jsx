import React from "react";
import { useNavigate } from "react-router-dom";
import emptyImg from "../assets/empty_quiz.png"; // put your local image here

const QuizList = () => {
  const navigate = useNavigate();

  // TODO: replace with real data; mocked empty list for now
  const quizzes = []; // e.g., [{id:1, title:'Unit 1 Quiz', questions:10}, ...]

  if (!quizzes.length) {
    return (
      <section className="empty-state">
        <img src={emptyImg} alt="No quizzes" className="empty-state__img" />
        <h3 className="empty-state__title">No quiz available</h3>
        <p className="empty-state__desc">
          Currently, there are no quizzes. Please add a new quiz.
        </p>
        <button className="primary-btn" onClick={() => navigate("/dashboard/new")}>
          Add New Quiz
        </button>
      </section>
    );
  }

  return (
    <section>
      <h3>My Quizzes</h3>
      <ul className="quiz-list">
        {quizzes.map(q => (
          <li key={q.id} className="quiz-item">
            <div>
              <div className="quiz-item__title">{q.title}</div>
              <div className="quiz-item__meta">{q.questions} questions</div>
            </div>
            <div className="quiz-item__actions">
              <button className="link-btn">Open</button>
              <button className="link-btn">Share</button>
              <button className="link-btn danger">Delete</button>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "1.5rem" }}>
        <button className="primary-btn" onClick={() => navigate("/dashboard/new")}>
          Add New Quiz
        </button>
      </div>
    </section>
  );
};

export default QuizList;
