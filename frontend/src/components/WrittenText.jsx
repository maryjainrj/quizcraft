import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import QuizSettingsModal from "../components/QuizSettingsModal";
import { generateQuiz } from "../api/quiz";
import { shuffleOptions } from "../utils/Shuffle";

const MIN_PASTE_CHARS = 30;

export default function WrittenText() {
  const navigate = useNavigate();

  const [pastedText, setPastedText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    language: "english",
    type: ["mcq"], // ['mcq','tf','fill']
    difficulty: "medium",
    count: 5,
  });

  const hasEnoughText = pastedText.trim().length >= MIN_PASTE_CHARS;

  return (
    <section className="flow">
      <header className="flow__header">
        <h2 className="flow__title">Paste Text</h2>
        <p className="flow__subtitle">Paste your study notes, textbook paragraphs, or bullet points to create a quiz.</p>
      </header>

      <div className="upload-dropzone paste-zone" role="region" aria-label="Paste study text">
        <p className="upload-dropzone__title">Paste Text</p>
        <p className="upload-dropzone__hint">We’ll generate questions from your pasted content.</p>

        <textarea
          className="paste-textarea"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste your study notes or paragraphs here..."
          rows={10}
        />

        <div className="paste-meta">
          <span>
            {pastedText.trim().length} characters
            {hasEnoughText ? "" : ` (minimum ${MIN_PASTE_CHARS} is required)`}
          </span>
          {pastedText && (
            <button className="link-btn" onClick={() => setPastedText("")}>
              Clear text
            </button>
          )}
        </div>
      </div>

      <div className="flow__actions">
        <button className="secondary-btn" onClick={() => navigate("/dashboard/new")}>
          Back
        </button>
        <button
          className="primary-btn"
          disabled={!hasEnoughText}
          onClick={() => setShowSettings(true)}
        >
          Create New Quiz
        </button>
      </div>

      <QuizSettingsModal
        open={showSettings}
        values={settings}
        setValues={setSettings}
        onClose={() => setShowSettings(false)}
        onCreate={async (vals) => {
          setShowSettings(false);
          try {
            const allTexts = pastedText.trim();
            const selectedTypes = Array.isArray(vals.type) ? vals.type : [vals.type];
            const perType = Math.ceil(vals.count / selectedTypes.length);
            let allQuestions = [];

            for (const t of selectedTypes) {
              const questionType = t === "mcq" ? "multiple-choice" : t === "tf" ? "true-false" : "fill-in-blank";
              const { questions: raw } = await generateQuiz(allTexts, {
                questionCount: perType,
                questionType,
                difficulty: vals.difficulty,
                language: vals.language,
              });
              const processed = raw.map((q) => {
                const base = { ...q, type: questionType };
                if (questionType === "multiple-choice" && base.options?.length > 0) return shuffleOptions(base);
                return base;
              });
              allQuestions = [...allQuestions, ...processed];
            }

            allQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, vals.count).map((q, i) => ({ ...q, id: i + 1 }));

            navigate("/dashboard/quiz-preview", {
              state: {
                questions: allQuestions,
                fileNames: [],
                pasted: true,
                settings: { questionTypes: selectedTypes, difficulty: vals.difficulty, count: vals.count },
              },
            });
          } catch (e) {
            alert(e.message || "Failed to generate quiz");
          }
        }}
      />
    </section>
  );
}
