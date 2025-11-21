import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { FiX, FiCopy, FiCheck, FiShare2 } from "react-icons/fi";
import quizcraftwhite from "../assets/logo_quizcraft.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const ShareQuizPage = () => {
  const navigate = useNavigate();

  // Load quiz from localStorage
  const saved = JSON.parse(localStorage.getItem("lastQuiz") || "{}");
  const { questions = [], fileNames = [] } = saved;

  const [uploading, setUploading] = useState("none"); // "none" | "questions" | "answers"
  const [questionUrl, setQuestionUrl] = useState("");
  const [answerUrl, setAnswerUrl] = useState("");
  const [copied, setCopied] = useState(null); // null | "question" | "answer"

  // Generate PDF and upload
  const generateAndUpload = async (includeAnswers) => {
    const type = includeAnswers ? "answers" : "questions";
    setUploading(type);

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

    questions.forEach((q, idx) => {
      const qNum = `${idx + 1}.`;
      const qText = `${qNum} ${q.question}`;
      const lines = doc.splitTextToSize(qText, pageWidth - 28);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(lines, 14, y);
      y += lines.length * 5 + 6;

      if (q.type === "multiple-choice" && q.options) {
        q.options.forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const line = `${letter}) ${opt}`;
          const split = doc.splitTextToSize(line, pageWidth - 35);
          doc.text(split, 22, y);
          y += split.length * 4.5 + 2;
        });
      }

      if (q.type === "true-false") {
        doc.text("• True", 22, y); y += 5;
        doc.text("• False", 22, y); y += 8;
      }

      if (q.type === "fill-in-blank") {
        doc.setDrawColor(180);
        doc.setLineWidth(0.4);
        doc.line(22, y - 1, pageWidth - 22, y - 1);
        y += 8;
      }

      if (includeAnswers) {
        let answer = "";
        if (q.type === "multiple-choice") {
          const idx = q.options?.findIndex((_, i) => String.fromCharCode(65 + i) === q.correctAnswer);
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

      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      } else {
        y += 6;
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    const blob = doc.output("blob");
    const filename = `QuizCraft_${type}.pdf`;

    const formData = new FormData();
    formData.append("pdf", blob, filename);
    formData.append("type", type);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/upload-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.url) {
        if (type === "questions") setQuestionUrl(data.url);
        else setAnswerUrl(data.url);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading("none");
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!questions.length) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">No quiz to share.</p>
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
        >
          <FiX size={24} />
        </button>

        <h3 className="text-2xl font-bold text-gray-800 mb-2">Share this Questions</h3>
        <p className="text-sm text-gray-600 mb-6">
          If you like this article share it with your friends.
        </p>

        {/* Share Quiz Questions */}
        <div className="mb-4">
          <button
            onClick={() => generateAndUpload(false)}
            disabled={uploading === "questions"}
            className="w-full flex items-center justify-between bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg p-4 transition-all group"
          >
            <div className="flex items-center gap-3">
              <FiShare2 size={20} className="group-hover:animate-pulse" />
              <span className="font-medium">Share Quiz Questions</span>
            </div>
            {uploading === "questions" ? (
              <span className="text-xs">Uploading...</span>
            ) : questionUrl ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={questionUrl}
                  className="text-xs bg-gray-50 px-2 py-1 rounded border w-48 text-left truncate"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(questionUrl, "question");
                  }}
                  className="text-purple-600 hover:text-purple-800"
                >
                  {copied === "question" ? <FiCheck size={16} /> : <FiCopy size={16} />}
                </button>
              </div>
            ) : (
              <span className="text-xs"> Share</span>
            )}
          </button>
        </div>

        {/* Share Quiz + Answers */}
        <div>
          <button
            onClick={() => generateAndUpload(true)}
            disabled={uploading === "answers"}
            className="w-full flex items-center justify-between bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg p-4 transition-all group"
          >
            <div className="flex items-center gap-3">
              <FiShare2 size={20} className="group-hover:animate-pulse" />
              <span className="font-medium">Share Quiz + Answers</span>
            </div>
            {uploading === "answers" ? (
              <span className="text-xs">Uploading...</span>
            ) : answerUrl ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={answerUrl}
                  className="text-xs bg-gray-50 px-2 py-1 rounded border w-48 text-left truncate"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(answerUrl, "answer");
                  }}
                  className="text-purple-600 hover:text-purple-800"
                >
                  {copied === "answer" ? <FiCheck size={16} /> : <FiCopy size={16} />}
                </button>
              </div>
            ) : (
              <span className="text-xs">Share</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareQuizPage;