// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; //added fOR UI

import QuestionsList from './components/QuestionsList';
import QuestionForm from './components/QuestionForm';
import { fetchAllQuestions, searchQuestionsByTopic, createQuestion, updateQuestion, deleteQuestion } from './services/api';
import './App.css';

import Login from './components/Login'; //added fOR UI
import Signup from './components/Signup'; //added fOR UI
// import Dashboard from './components/Dashboard'; // Removed: Replaced by DashboardLayout
import DashboardLayout from './components/DashboardLayout'; // Added: For nested dashboard routes
import QuizList from './components/QuizList'; // Added: For dashboard index route
import SourceSelect from './components/SourceSelect'; // Added: For /dashboard/new route
import UploadFiles from './components/UploadFiles'; // Added: For /dashboard/new/upload route
import QuizPreviewPage from "./components/QuizPreviewPage";; // Added: For /dashboard/quiz-preview route
function App() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [searchTopic, setSearchTopic] = useState('');

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await fetchAllQuestions();
      setQuestions(data);
    } catch (error) {
      alert('Error loading questions: ' + error.message);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchTopic.trim()) {
      return loadQuestions();
    }
    setLoading(true);
    try {
      const data = await searchQuestionsByTopic(searchTopic);
      setQuestions(data);
    } catch (error) {
      alert('Error searching questions: ' + error.message);
    }
    setLoading(false);
  };

  const handleCreate = async (formData) => {
    setLoading(true);
    try {
      await createQuestion(formData);
      alert('Question created successfully!');
      loadQuestions();
      setActiveTab('list');
    } catch (error) {
      alert('Error creating question: ' + error.message);
    }
    setLoading(false);
  };

  const handleUpdate = async (id, formData) => {
    setLoading(true);
    try {
      await updateQuestion(id, formData);
      alert('Question updated successfully!');
      setEditingQuestion(null);
      loadQuestions();
      setActiveTab('list');
    } catch (error) {
      alert('Error updating question: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }
    setLoading(true);
    try {
      await deleteQuestion(id);
      loadQuestions();
    } catch (error) {
      alert('Error deleting question: ' + error.message);
    }
    setLoading(false);
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  //added for UI
  const QuizAdmin = () => (
    <div className="app-container">
      <div className="app-content">
        <header className="app-header">
          <h1>Quiz Admin Panel</h1>
        </header>

        <div className="tabs">
          <button
            onClick={() => { setActiveTab('list'); setEditingQuestion(null); }}
            className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
          >
            Questions List
          </button>
          <button
            onClick={() => { setActiveTab('create'); setEditingQuestion(null); }}
            className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
          >
            ➕ Create Question
          </button>
        </div>

        <main className="main-content">
          {activeTab === 'list' ? (
            <QuestionsList
              questions={questions}
              loading={loading}
              searchTopic={searchTopic}
              onSearchChange={setSearchTopic}
              onSearch={handleSearch}
              onClearSearch={() => { setSearchTopic(''); loadQuestions(); }}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <QuestionForm
              editingQuestion={editingQuestion}
              loading={loading}
              onSubmit={editingQuestion ? handleUpdate : handleCreate}
              onCancel={handleCancelEdit}
            />
          )}
        </main>
      </div>
    </div>
  );

  return (
  <BrowserRouter>
    <Routes>
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Dashboard with Nested Routes */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<QuizList />} />
        <Route path="new" element={<SourceSelect />} />
        <Route path="new/upload" element={<UploadFiles />} />
        <Route path="quiz-preview" element={<QuizPreviewPage />} /> {/* Fixed */}
        {/* Add more dashboard pages here */}
      </Route>

      {/* Admin Panel */}
      <Route path="/admin" element={<QuizAdmin />} />
    </Routes>
  </BrowserRouter>
);
}

export default App;