// src/components/QuestionsList.js
import React from 'react';
import { FaEdit, FaTrash, FaSearch } from 'react-icons/fa';
import './QuestionsList.css';

const QuestionsList = ({
  questions,
  loading,
  searchTopic,
  onSearchChange,
  onSearch,
  onClearSearch,
  onEdit,
  onDelete
}) => {
  return (
    <div className="questions-list">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by topic..."
          value={searchTopic}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onSearch()}
          className="search-input"
        />
        <button onClick={onSearch} className="btn btn-search">
          <FaSearch /> Search
        </button>
        <button onClick={onClearSearch} className="btn btn-clear">
          Clear
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="no-data">No questions found</div>
      ) : (
        <div className="questions-grid">
          {questions.map((q) => (
            <div key={q.id} className="question-card">
              <div className="question-header">
                <h3 className="question-title">{q.question}</h3>
                <div className="question-actions">
                  <button
                    onClick={() => onEdit(q)}
                    className="action-btn edit-btn"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => onDelete(q.id)}
                    className="action-btn delete-btn"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="question-badges">
                <span className="badge badge-topic">{q.topic}</span>
                <span className={`badge badge-${q.difficulty}`}>
                  {q.difficulty}
                </span>
              </div>

              <div className="options-grid">
                {q.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`option ${opt === q.correctAnswer ? 'correct' : ''}`}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionsList;