// src/pages/ExportQuizPage.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { FiX, FiDownload } from "react-icons/fi";
import quizcraftwhite from "../assets/quizcraftwhite.png";

const ExportQuizPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Load from state OR localStorage (fallback)
  const saved = JSON.parse(localStorage.getItem("lastQuiz") || "{}");
  const { questions = [], fileNames = [], settings = {} } = state || saved;

  const [includeAnswers, setIncludeAnswers] = useState(false);

  // Generate PDF
  const generatePDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 25;

    // Logo
    const logo = new Image();
    logo.src = quizcraftwhite;
    doc.addImage(logo, "PNG", 14, 10, 32, 13);

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("QuizCraft – Generated Quiz", pageWidth / 2, 18, { align: "center" });

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`From: ${fileNames.join(", ")}`, pageWidth / 2, 24, { align: "center" });

    y = 34;

    // Questions
    questions.forEach((q, idx) => {
      const qNum = `${idx + 1}.`;
      const qText = `${qNum} ${q.question}`;
      const lines = doc.splitTextToSize(qText, pageWidth - 28);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(lines, 14, y);
      y += lines.length * 5 + 6;

      // Multiple Choice
      if (q.type === "multiple-choice" && q.options) {
        q.options.forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const line = `${letter}) ${opt}`;
          const split = doc.splitTextToSize(line, pageWidth - 35);
          doc.text(split, 22, y);
          y += split.length * 4.5 + 2;
        });
      }

      // True/False
      if (q.type === "true-false") {
        doc.text("• True", 22, y); y += 5;
        doc.text("• False", 22, y); y += 8;
      }

      // Fill in Blank
      if (q.type === "fill-in-blank") {
        doc.setDrawColor(180);
        doc.setLineWidth(0.4);
        doc.line(22, y - 1, pageWidth - 22, y - 1);
        y += 8;
      }

      // Answer
      if (includeAnswers) {
        let answer = "";
        if (q.type === "multiple-choice") {
          const idx = q.options?.findIndex(
            (_, i) => String.fromCharCode(65 + i) === q.correctAnswer
          );
          answer = idx >= 0 ? `${q.correctAnswer}) ${q.options[idx]}` : q.correctAnswer || "—";
        } else if (q.type === "true-false") {
          answer = q.correctAnswer === "TRUE" ? "True" : "False";
        } else if (q.type === "fill-in-blank") {
          answer = q.correctAnswer || "—";
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(`Answer: ${answer}`, 14, y);
        y += 7;
        doc.setTextColor(0, 0, 0);
      }

      // Page break
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      } else {
        y += 6;
      }
    });

    // Page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    const suffix = includeAnswers ? "answers" : "questions";
    doc.save(`QuizCraft_${suffix}.pdf`);
  };

  if (!questions.length) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">No quiz found.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
        >
          <FiX size={24} />
        </button>

        <h3 className="text-2xl font-bold text-gray-800 mb-2">Export Quiz</h3>
        <p className="text-sm text-gray-600 mb-6">
          Manage your quiz questions here. You can edit and delete questions.
        </p>

        <button
          onClick={() => {
            setIncludeAnswers(false);
            setTimeout(generatePDF, 100);
          }}
          className="w-full flex items-center justify-between bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg p-4 mb-3 transition-all group"
        >
          <div className="flex items-center gap-3">
            <FiDownload size={22} className="group-hover:animate-bounce" />
            <span className="font-semibold text-lg">Export PDF Questions</span>
          </div>
          <span className="text-xs max-w-[160px] text-right">
            Download the questions in PDF format. With your logo and colors.
          </span>
        </button>

        <button
          onClick={() => {
            setIncludeAnswers(true);
            setTimeout(generatePDF, 100);
          }}
          className="w-full flex items-center justify-between bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg p-4 transition-all group"
        >
          <div className="flex items-center gap-3">
            <FiDownload size={22} className="group-hover:animate-bounce" />
            <span className="font-semibold text-lg">Export PDF Answers</span>
          </div>
          <span className="text-xs max-w-[160px] text-right">
            Download the questions and answers in PDF format. With your logo and colors.
          </span>
        </button>
      </div>
    </div>
  );
};

export default ExportQuizPage;