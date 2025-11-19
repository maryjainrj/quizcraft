// src/pages/QuizPreviewPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { saveQuestionSetToDB } from '../services/quizER';
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { FiEdit2, FiTrash2, FiChevronDown, FiChevronUp, FiDownload, FiCheck, FiX } from "react-icons/fi";
import jsPDF from 'jspdf';
import QuizNameModal from '../components/QuizNameModal';

const QuizPreviewPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { searchQuery } = useOutletContext() || { searchQuery: "" }; // ✅ GET SEARCH FROM CONTEXT
  
  const [showAnswers, setShowAnswers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [localQuestions, setLocalQuestions] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [tempQuestion, setTempQuestion] = useState({});

  const { fileNames = [], extractedTexts = {}, settings = {} } = state || {};
  const questions = state?.questions || [];

  // Initialize localQuestions on mount
  useEffect(() => {
    setLocalQuestions(questions);
  }, [questions]);

  // Save to localStorage
  useEffect(() => {
    if (localQuestions.length > 0) {
      localStorage.setItem("lastQuiz", JSON.stringify({ questions: localQuestions, fileNames, settings }));
    }
  }, [localQuestions, fileNames, settings]);

  // ✅ FILTER QUESTIONS BASED ON SEARCH QUERY
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) {
      return localQuestions.map((q, idx) => ({ ...q, originalIdx: idx }));
    }
    
    const query = searchQuery.toLowerCase();
    return localQuestions
      .map((q, idx) => ({ ...q, originalIdx: idx }))
      .filter(q => {
        const qMatch = q.question?.toLowerCase().includes(query);
        const aMatch = q.correctAnswer?.toLowerCase().includes(query);
        const oMatch = q.options?.some(opt => opt?.toLowerCase().includes(query));
        return qMatch || aMatch || oMatch;
      });
  }, [localQuestions, searchQuery]);

  // ✅ HIGHLIGHT MATCHING TEXT IN SEARCH RESULTS
  const highlightText = (text, query) => {
    if (!query.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ?
        <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark> : part
    );
  };

  // Count AI vs Fallback questions
  const aiCount = localQuestions.filter(q => q.source === 'ai').length;
  const fallbackCount = localQuestions.filter(q => q.source === 'fallback').length;

  // Delete question
  const handleDelete = (index) => {
    setLocalQuestions(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex > index) {
      setEditingIndex(prev => prev - 1);
    }
  };

  // Start editing
  const handleEditStart = (index) => {
    setEditingIndex(index);
    setTempQuestion({ ...localQuestions[index] });
  };

  // Save edit
  const handleEditSave = () => {
    setLocalQuestions(prev => prev.map((q, i) => i === editingIndex ? tempQuestion : q));
    setEditingIndex(null);
  };

  // Cancel edit
  const handleEditCancel = () => {
    setEditingIndex(null);
  };

  // Generate PDF from quiz
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Quiz', margin, yPos);
    yPos += 10;

    // Metadata
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Questions: ${localQuestions.length}`, margin, yPos);
    yPos += 6;
    doc.text(`Source: ${fileNames.join(', ')}`, margin, yPos);
    yPos += 6;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
    yPos += 15;

    // Questions
    localQuestions.forEach((q, idx) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      const questionText = `${idx + 1}. ${q.question}`;
      const splitQuestion = doc.splitTextToSize(questionText, pageWidth - 2 * margin);
      doc.text(splitQuestion, margin, yPos);
      yPos += splitQuestion.length * 7 + 5;

      if (q.type === 'multiple-choice' && q.options) {
        doc.setFont(undefined, 'normal');
        q.options.forEach((opt, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          const optionText = `${letter}) ${opt}`;
          const splitOption = doc.splitTextToSize(optionText, pageWidth - 2 * margin - 5);
          doc.text(splitOption, margin + 5, yPos);
          yPos += splitOption.length * 6 + 3;
        });
      }

      if (q.type === 'true-false') {
        doc.setFont(undefined, 'normal');
        doc.text('○ True', margin + 5, yPos);
        yPos += 7;
        doc.text('○ False', margin + 5, yPos);
        yPos += 7;
      }

      if (q.type === 'fill-in-blank') {
        doc.setFont(undefined, 'normal');
        doc.text('Answer: _________________________', margin + 5, yPos);
        yPos += 10;
      }

      yPos += 5;
    });

    // Answer key
    doc.addPage();
    yPos = 20;
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Answer Key', margin, yPos);
    yPos += 15;

    doc.setFontSize(11);
    localQuestions.forEach((q, idx) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      let answerText = '';
      if (q.type === 'multiple-choice') {
        const correctIdx = q.options?.findIndex(
          (_, i) => String.fromCharCode(65 + i) === q.correctAnswer
        );
        answerText = correctIdx >= 0
          ? `${q.correctAnswer}) ${q.options[correctIdx]}`
          : q.correctAnswer;
      } else if (q.type === 'true-false') {
        answerText = q.correctAnswer === 'TRUE' ? 'True' : 'False';
      } else {
        answerText = q.correctAnswer;
      }

      doc.setFont(undefined, 'bold');
      doc.text(`${idx + 1}.`, margin, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(answerText, margin + 10, yPos);
      yPos += 8;
    });

    return doc;
  };

  const downloadPDF = () => {
    const doc = generatePDF();
    doc.save('quiz.pdf');
  };

  const uploadPDF = async () => {
    try {
      const doc = generatePDF();
      const pdfBlob = doc.output('blob');
      
      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'quiz.pdf');

      const response = await fetch('http://localhost:5000/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      return data.url;
    } catch (err) {
      console.error('PDF upload error:', err);
      throw err;
    }
  };

  const handleSave = () => {
    setShowNameModal(true);
  };

  const handleSaveWithName = async (quizName) => {
    if (!localQuestions?.length) {
      alert("No questions to save.");
      return;
    }

    setSaving(true);
    setShowNameModal(false);

    try {
      const pdfUrl = await uploadPDF();
      await saveQuestionSetToDB(quizName, localQuestions, fileNames, extractedTexts, settings, pdfUrl);
      
      alert('Quiz and PDF saved successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error("Save failed:", err);
      alert('Failed to save quiz: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (!localQuestions.length) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">No quiz generated yet.</p>
        <button
          onClick={() => navigate("/dashboard/new/upload")}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
        >
          Back to Upload
        </button>
      </div>
    );
  }

  const uniqueTypes = [...new Set(localQuestions.map(q => q.type))];
  const typeLabels = {
    'multiple-choice': 'Multiple Choice',
    'true-false': 'True/False',
    'fill-in-blank': 'Fill in the Blank'
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiz Preview</h1>
      <p className="text-sm text-gray-600 mb-2">
        {localQuestions.length} question{localQuestions.length !== 1 ? 's' : ''} generated from {fileNames.join(', ')}
      </p>
      <p className="text-xs text-gray-500 mb-4">
        Types: {uniqueTypes.map(t => typeLabels[t]).join(', ')}
      </p>



      {/* ✅ SEARCH RESULTS COUNTER */}
      {searchQuery.trim() && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Showing <strong>{filteredQuestions.length}</strong> of <strong>{localQuestions.length}</strong> questions matching "<strong>{searchQuery}</strong>"
          </p>
        </div>
      )}

      {/* Questions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Questions</h2>
        
        {filteredQuestions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No questions match your search.</p>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              const i = q.originalIdx; // Use original index for editing/deleting
              const isAI = q.source === 'ai';
              
              return (
                <div
                  key={q.id || i}
                  className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:shadow-md"
                >
                  <span className="font-medium text-gray-700 min-w-[20px]">{i + 1}.</span>
                  
                  <div className="flex-1">
                    {i === editingIndex ? (
                      <div className="space-y-3">
                        {/* Question text input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Question:</label>
                          <input
                            type="text"
                            value={tempQuestion.question || ''}
                            onChange={(e) => setTempQuestion(prev => ({ ...prev, question: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {tempQuestion.type === "multiple-choice" && tempQuestion.options && (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Options:</label>
                            {tempQuestion.options.map((opt, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-600 min-w-[24px]">{letter})</span>
                                  <input
                                    type="text"
                                    value={opt || ''}
                                    onChange={(e) => {
                                      setTempQuestion(prev => ({
                                        ...prev,
                                        options: prev.options.map((o, j) => j === idx ? e.target.value : o)
                                      }));
                                    }}
                                    className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>
                              );
                            })}
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer:</label>
                            <select
                              value={tempQuestion.correctAnswer || ''}
                              onChange={(e) => setTempQuestion(prev => ({ ...prev, correctAnswer: e.target.value }))}
                              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">Select Option</option>
                              {tempQuestion.options?.map((_, idx) => (
                                <option key={idx} value={String.fromCharCode(65 + idx)}>
                                  {String.fromCharCode(65 + idx)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {tempQuestion.type === "true-false" && (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer:</label>
                            <select
                              value={tempQuestion.correctAnswer || ''}
                              onChange={(e) => setTempQuestion(prev => ({ ...prev, correctAnswer: e.target.value }))}
                              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="TRUE">True</option>
                              <option value="FALSE">False</option>
                            </select>
                          </div>
                        )}

                        {tempQuestion.type === "fill-in-blank" && (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer:</label>
                            <input
                              type="text"
                              value={tempQuestion.correctAnswer || ''}
                              onChange={(e) => setTempQuestion(prev => ({ ...prev, correctAnswer: e.target.value }))}
                              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/*  HIGHLIGHTED QUESTION TEXT */}
                        <p className="text-gray-900 font-medium mb-3 text-base leading-relaxed text-left">
                          {highlightText(q.question, searchQuery)}
                        </p>

                        {q.type === "multiple-choice" && q.options && (
                          <ul className="space-y-2 text-sm text-gray-700">
                            {q.options.map((opt, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <li key={idx} className="flex items-center gap-3 py-1 text-left">
                                  <span className="font-semibold text-gray-600 min-w-[24px]">{letter})</span>
                                  {/*  HIGHLIGHTED OPTION TEXT */}
                                  <span className="text-gray-900">{highlightText(opt, searchQuery)}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {q.type === "true-false" && (
                          <div className="flex justify-start gap-8 mt-4 mb-2">
                            <label className="flex items-center gap-3 cursor-pointer group py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors">
                              <span className="w-6 h-6 border-[3px] border-gray-400 rounded-full flex items-center justify-center group-hover:border-gray-600 transition-colors flex-shrink-0">
                                <span className="w-0 h-0 bg-purple-600 rounded-full group-hover:w-3 group-hover:h-3 transition-all"></span>
                              </span>
                              <span className="text-base font-medium text-gray-700">True</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors">
                              <span className="w-6 h-6 border-[3px] border-gray-400 rounded-full flex items-center justify-center group-hover:border-gray-600 transition-colors flex-shrink-0">
                                <span className="w-0 h-0 bg-purple-600 rounded-full group-hover:w-3 group-hover:h-3 transition-all"></span>
                              </span>
                              <span className="text-base font-medium text-gray-700">False</span>
                            </label>
                          </div>
                        )}

                        {q.type === "fill-in-blank" && (
                          <div className="ml-6 mt-2">
                            <div className="w-full max-w-md h-10 border-2 border-dashed border-gray-300 rounded-md bg-gray-50 relative">
                              <div className="absolute bottom-2 left-3 right-3 h-[2px] bg-gradient-to-r from-gray-300 via-transparent to-gray-300 opacity-50"></div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    {i === editingIndex ? (
                      <>
                        <button
                          onClick={handleEditSave}
                          className="text-green-600 hover:text-green-800 transition p-2 rounded hover:bg-green-50"
                        >
                          <FiCheck size={18} />
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="text-gray-600 hover:text-gray-800 transition p-2 rounded hover:bg-gray-50"
                        >
                          <FiX size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditStart(i)}
                          className="text-blue-600 hover:text-blue-800 transition p-2 rounded hover:bg-blue-50"
                        >
                          <FiEdit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(i)}
                          className="text-red-600 hover:text-red-800 transition p-2 rounded hover:bg-red-50"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Answers Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className="w-full flex items-center justify-between text-lg font-semibold text-gray-700 hover:text-gray-900 transition"
        >
          <span>View Answers</span>
          {showAnswers ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </button>

        {showAnswers && (
          <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
            {filteredQuestions.map((q) => {
              const i = q.originalIdx;
              let answerText = "";
              if (q.type === "multiple-choice") {
                const correctIdx = q.options?.findIndex(
                  (_, idx) => String.fromCharCode(65 + idx) === q.correctAnswer
                );
                answerText = correctIdx >= 0
                  ? `${q.correctAnswer}) ${q.options[correctIdx]}`
                  : q.correctAnswer || "Not specified";
              } else if (q.type === "true-false") {
                answerText = q.correctAnswer === "TRUE" ? "True" : "False";
              } else if (q.type === "fill-in-blank") {
                answerText = q.correctAnswer || "Not specified";
              }

              return (
                <div
                  key={q.id || i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-700 min-w-[24px]">{i + 1}.</span>
                  <div className="flex-1 text-left">
                    {/*  HIGHLIGHTED ANSWER */}
                    <span className="text-gray-900 font-semibold text-base">
                      {highlightText(answerText, searchQuery)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between items-center gap-3">
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/dashboard/new/upload")}
            className="px-6 py-2.5 border-2 border-gray-300 bg-white text-gray-700 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
          >
            Back
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Quiz'}
          </button>
        </div>
      </div>

      {/* Quiz Name Modal */}
      <QuizNameModal
        open={showNameModal}
        defaultName={fileNames.length > 0 ? `Quiz from ${fileNames.join(', ')}` : 'My Quiz'}
        onClose={() => setShowNameModal(false)}
        onSave={handleSaveWithName}
      />
    </div>
  );
};
      
export default QuizPreviewPage;