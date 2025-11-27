import React, { useState } from 'react';
import './QuizNameModal.css';

const QuizNameModal = ({ open, onClose, onSave, defaultName = '' }) => {
  const [quizName, setQuizName] = useState(defaultName);
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmedName = quizName.trim();
    
    if (!trimmedName) {
      setError('Quiz name is required');
      return;
    }
    
    if (trimmedName.length < 3) {
      setError('Quiz name must be at least 3 characters');
      return;
    }
    
    onSave(trimmedName);
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Save Quiz</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          <label htmlFor="quiz-name" className="modal-label">
            Quiz Name <span className="required">*</span>
          </label>
          <input
            id="quiz-name"
            type="text"
            className="modal-input"
            placeholder="Enter quiz name..."
            value={quizName}
            onChange={(e) => {
              setQuizName(e.target.value);
              setError('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            autoFocus
          />
          {error && <p className="modal-error">{error}</p>}
          <p className="modal-hint">
            Give your quiz a memorable name to easily find it later
          </p>
        </div>
        
        <div className="modal-footer">
          <button className="modal-btn cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button className="modal-btn save-btn" onClick={handleSave}>
            Save Quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizNameModal;