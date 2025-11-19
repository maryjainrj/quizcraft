import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import QuestionsList from "./components/QuestionsList";
import QuestionForm from "./components/QuestionForm";
import {
  fetchAllQuestions,
  searchQuestionsByTopic,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "./services/api";
import "./App.css";

import Login from "./components/Login";
import Signup from "./components/Signup";
import LandingPage from "./components/LandingPage";

import DashboardLayout from "./components/DashboardLayout";
import QuizzesPage from "./components/QuizzesPage";          // list of quizzes
import QuizDetailPage from "./components/QuizDetailPage";    // single quiz detail
import SourceSelect from "./components/SourceSelect";
import UploadFiles from "./components/UploadFiles";
import WrittenText from "./components/WrittenText";
import QuizPreviewPage from "./components/QuizPreviewPage";
import ExportQuizPage from "./components/ExportQuizPage";
import ShareQuizPage from "./components/ShareQuizPage";

// Toasts
import { useToast } from "./components/ToastProvider.jsx";

// Some builds export ForgotPassword as default, others as named.
import * as ForgotPasswordMod from "./components/ForgotPassword.jsx";
const ForgotPassword =
  ForgotPasswordMod.default ?? ForgotPasswordMod.ForgotPassword;

function App() {
  const toast = useToast();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [searchTopic, setSearchTopic] = useState("");

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await fetchAllQuestions();
      setQuestions(data);
    } catch (error) {
      toast.error(`Error loading questions: ${error.message}`);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchTopic.trim()) return loadQuestions();
    setLoading(true);
    try {
      const data = await searchQuestionsByTopic(searchTopic);
      setQuestions(data);
    } catch (error) {
      toast.error(`Error searching questions: ${error.message}`);
    }
    setLoading(false);
  };

  const handleCreate = async (formData) => {
    setLoading(true);
    try {
      await createQuestion(formData);
      toast.success("Question created successfully!");
      loadQuestions();
      setActiveTab("list");
    } catch (error) {
      toast.error(`Error creating question: ${error.message}`);
    }
    setLoading(false);
  };

  const handleUpdate = async (id, formData) => {
    setLoading(true);
    try {
      await updateQuestion(id, formData);
      toast.success("Question updated successfully!");
      setEditingQuestion(null);
      loadQuestions();
      setActiveTab("list");
    } catch (error) {
      toast.error(`Error updating question: ${error.message}`);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    setLoading(true);
    try {
      await deleteQuestion(id);
      toast.info("Question deleted.");
      loadQuestions();
    } catch (error) {
      toast.error(`Error deleting question: ${error.message}`);
    }
    setLoading(false);
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setActiveTab("create");
  };

  const handleCancelEdit = () => setEditingQuestion(null);

  // Don't auto-load questions on mount - let individual routes handle it
  // useEffect(() => {
  //   loadQuestions();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  // Legacy demo admin panel
  const QuizAdmin = () => (
    <div className="app-container">
      <div className="app-content">
        <header className="app-header">
          <h1>Quiz Admin Panel</h1>
        </header>

        <div className="tabs">
          <button
            onClick={() => {
              setActiveTab("list");
              setEditingQuestion(null);
            }}
            className={`tab-button ${activeTab === "list" ? "active" : ""}`}
          >
            Questions List
          </button>
          <button
            onClick={() => {
              setActiveTab("create");
              setEditingQuestion(null);
            }}
            className={`tab-button ${activeTab === "create" ? "active" : ""}`}
          >
            ➕ Create Question
          </button>
        </div>

        <main className="main-content">
          {activeTab === "list" ? (
            <QuestionsList
              questions={questions}
              loading={loading}
              searchTopic={searchTopic}
              onSearchChange={setSearchTopic}
              onSearch={handleSearch}
              onClearSearch={() => {
                setSearchTopic("");
                loadQuestions();
              }}
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
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {ForgotPassword && (
          <Route path="/forgot-password" element={<ForgotPassword />} />
        )}

        {/* Dashboard + nested pages */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<QuizzesPage />} />
          <Route path="quiz/:id" element={<QuizDetailPage />} />
          <Route path="new" element={<SourceSelect />} />
          <Route path="new/upload" element={<UploadFiles />} />
          <Route path="new/text" element={<WrittenText />} />
          <Route path="quiz-preview" element={<QuizPreviewPage />} />
          <Route path="exportquiz" element={<ExportQuizPage />} />
          <Route path="sharequiz" element={<ShareQuizPage />} />
        </Route>

        {/* Legacy admin panel */}
        <Route path="/admin" element={<QuizAdmin />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
