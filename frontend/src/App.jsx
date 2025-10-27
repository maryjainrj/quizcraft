// src/App.js
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
import Dashboard from "./components/Dashboard";

// 🔒 Route guard + logout button
import PrivateRoute from "./components/PrivateRoute";
import LogoutButton from "./components/LogoutButton";

// ✅ Read token (prefers sessionStorage, falls back to localStorage)
// If your auth util already exports this, import from there instead.
const getToken = () =>
  sessionStorage.getItem("qc_token") || localStorage.getItem("qc_token") || null;

// Redirect away from /login or /signup if already authenticated
function RequireLoggedOut({ children }) {
  const token = getToken();
  return token ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
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
      alert("Error loading questions: " + error.message);
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
      alert("Error searching questions: " + error.message);
    }
    setLoading(false);
  };

  const handleCreate = async (formData) => {
    setLoading(true);
    try {
      await createQuestion(formData);
      alert("Question created successfully!");
      loadQuestions();
      setActiveTab("list");
    } catch (error) {
      alert("Error creating question: " + error.message);
    }
    setLoading(false);
  };

  const handleUpdate = async (id, formData) => {
    setLoading(true);
    try {
      await updateQuestion(id, formData);
      alert("Question updated successfully!");
      setEditingQuestion(null);
      loadQuestions();
      setActiveTab("list");
    } catch (error) {
      alert("Error updating question: " + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    setLoading(true);
    try {
      await deleteQuestion(id);
      loadQuestions();
    } catch (error) {
      alert("Error deleting question: " + error.message);
    }
    setLoading(false);
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setActiveTab("create");
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  // ---- Existing Quiz Admin Panel (with a logout button) ----
  const QuizAdmin = () => (
    <div className="app-container">
      <div className="app-content">
        <header
          className="app-header"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <h1>Quiz Admin Panel</h1>
          <LogoutButton className="btn-logout">Logout</LogoutButton>
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
        {/* Default route: if logged in go to dashboard, else to login */}
        <Route
          path="/"
          element={getToken() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
        />

        {/* Public routes (blocked if already logged in) */}
        <Route
          path="/login"
          element={
            <RequireLoggedOut>
              <Login />
            </RequireLoggedOut>
          }
        />
        <Route
          path="/signup"
          element={
            <RequireLoggedOut>
              <Signup />
            </RequireLoggedOut>
          }
        />

        {/* Protected routes — use PrivateRoute that checks token and renders <Outlet/> */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<QuizAdmin />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
