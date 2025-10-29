// src/pages/QuizPreviewPage.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiEdit2, FiTrash2, FiChevronDown, FiChevronUp } from "react-icons/fi";

const QuizPreviewPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [showAnswers, setShowAnswers] = useState(false);

  const { questions = [], fileNames = [], settings = {} } = state || {};

  if (!questions.length) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">No quiz generated yet.</p>
        <button
          onClick={() => navigate("/dashboard/new/upload")}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
        >
          Back to Upload
        </button>
      </div>
    );
  }

  // Get unique question types in the quiz
  const uniqueTypes = [...new Set(questions.map(q => q.type))];
  const typeLabels = {
    'multiple-choice': 'Multiple Choice',
    'true-false': 'True/False',
    'fill-in-blank': 'Fill in the Blank'
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiz Preview</h1>
      <p className="text-sm text-gray-600 mb-2">
        {questions.length} question{questions.length !== 1 ? 's' : ''} generated from {fileNames.join(', ')}
      </p>
      <p className="text-xs text-gray-500 mb-8">
        Types: {uniqueTypes.map(t => typeLabels[t]).join(', ')}
      </p>

      {/* Available Questions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Questions</h2>
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:shadow-md">
              <span className="font-medium text-gray-700 min-w-[20px]">{i + 1}.</span>
              <div className="flex-1">
                <p className="text-gray-900 font-medium mb-3 text-base leading-relaxed text-left">{q.question}</p>

                {/* Multiple Choice Options */}
                {q.type === "multiple-choice" && q.options && q.options.length > 0 && (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {q.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      return (
                        <li key={idx} className="flex items-center gap-3 py-1 text-left">
                          <span className="font-semibold text-gray-600 min-w-[24px]">{letter})</span>
                          <span className="text-gray-900">{opt}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* True/False Options - LARGER RADIO BUTTONS - LEFT ALIGNED */}
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

                {/* Fill in the Blank */}
                {q.type === "fill-in-blank" && (
                  <div className="ml-6 mt-2">
                    <div className="w-full max-w-md h-10 border-2 border-dashed border-gray-300 rounded-md bg-gray-50 relative">
                      <div className="absolute bottom-2 left-3 right-3 h-[2px] bg-gradient-to-r from-gray-300 via-transparent to-gray-300 opacity-50"></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 italic">Student fills in the answer</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button className="text-blue-600 hover:text-blue-800 transition p-2 rounded hover:bg-blue-50">
                  <FiEdit2 size={18} />
                </button>
                <button className="text-red-600 hover:text-red-800 transition p-2 rounded hover:bg-red-50">
                  <FiTrash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View Answers */}
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
            {questions.map((q, i) => {
              let answerText = "";

              if (q.type === "multiple-choice") {
                if (q.correctAnswer && q.options) {
                  const correctIdx = q.options.findIndex(
                    (_, idx) => String.fromCharCode(65 + idx) === q.correctAnswer
                  );
                  if (correctIdx >= 0) {
                    answerText = `${q.correctAnswer}) ${q.options[correctIdx]}`;
                  } else {
                    const textIdx = q.options.findIndex(opt => opt === q.correctAnswer);
                    if (textIdx >= 0) {
                      answerText = `${String.fromCharCode(65 + textIdx)}) ${q.correctAnswer}`;
                    } else {
                      answerText = q.correctAnswer;
                    }
                  }
                } else {
                  answerText = q.correctAnswer || "Not specified";
                }
              } else if (q.type === "true-false") {
                answerText = q.correctAnswer === "TRUE" ? "True" : "False";
              } else if (q.type === "fill-in-blank") {
                answerText = q.correctAnswer || "Not specified";
              }

              return (
                <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                  <span className="font-semibold text-gray-700 min-w-[24px]">{i + 1}.</span>
                  <div className="flex-1 text-left">
                    <span className="text-gray-900 font-semibold text-base">{answerText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => navigate("/dashboard/new/upload")}
          className="px-6 py-2.5 border-2 border-gray-300 bg-white text-gray-700 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
        >
          Back
        </button>
        <button className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all hover:-translate-y-0.5">
          Save Quiz
        </button>
      </div>
    </div>
  );
};

export default QuizPreviewPage;