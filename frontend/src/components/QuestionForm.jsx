// src/components/QuestionForm.js
import React, { useState, useEffect } from 'react';
import './QuestionForm.css';

const QuestionForm = ({ editingQuestion, loading, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    difficulty: 'medium',
    topic: ''
  });

  useEffect(() => {
    if (editingQuestion) {
      setFormData({
        question: editingQuestion.question,
        options: editingQuestion.options,
        correctAnswer: editingQuestion.correctAnswer,
        difficulty: editingQuestion.difficulty,
        topic: editingQuestion.topic
      });
    } else {
      setFormData({
        question: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        difficulty: 'medium',
        topic: ''
      });
    }
  }, [editingQuestion]);

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.correctAnswer) {
      alert('Please select a correct answer');
      return;
    }

    if (editingQuestion) {
      onSubmit(editingQuestion.id, formData);
    } else {
      onSubmit(formData);
    }
  };

  return (
    <div className="question-form">
      <h2 className="form-title">
        {editingQuestion ? 'Edit Question' : 'Create New Question'}
      </h2>

      <div className="form-container" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Question *</label>
          <input
            type="text"
            required
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            className="form-input"
            placeholder="Enter your question here..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Options *</label>
          {formData.options.map((opt, i) => (
            <input
              key={i}
              type="text"
              required
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => handleOptionChange(i, e.target.value)}
              className="form-input option-input"
            />
          ))}
        </div>

        <div className="form-group">
          <label className="form-label">Correct Answer *</label>
          <select
            required
            value={formData.correctAnswer}
            onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
            className="form-select"
          >
            <option value="">Select correct answer</option>
            {formData.options.map((opt, i) => (
              <option key={i} value={opt} disabled={!opt}>
                {opt || `Option ${i + 1} (fill option first)`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Difficulty *</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className="form-select"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Topic *</label>
            <input
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              className="form-input"
              placeholder="e.g., Mathematics, Science..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Saving...' : editingQuestion ? 'Update Question' : 'Create Question'}
          </button>
          {editingQuestion && (
            <button
              onClick={onCancel}
              type="button"
              className="btn btn-secondary"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionForm;