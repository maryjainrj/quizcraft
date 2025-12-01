import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import QuizSettingsModal from "../components/QuizSettingsModal";
import { generateQuiz } from "../api/quiz";
import { shuffleOptions } from "../utils/Shuffle";

const MIN_PASTE_CHARS = 30;

// ------- Keyword Filtering (for pasted text) -------
function filterTextByKeywords(text, keywordsStr) {
  if (!keywordsStr || !keywordsStr.trim()) return text;
  
  let keywords = [];
  const input = keywordsStr.toLowerCase().trim();
  
  // Remove common prefixes like "create quiz from", "generate questions from", etc.
  const cleanedInput = input
    .replace(/^(create|generate|make)\s+(quiz|questions?)\s+(from|about|on)\s+/i, '')
    .trim();
  
  // Pattern 1: "X to Y" or "from X to Y" for section ranges
  const sectionRangeMatch = cleanedInput.match(/(?:from\s+)?(.+?)\s+to\s+(.+?)$/i);
  if (sectionRangeMatch) {
    const [_, startSection, endSection] = sectionRangeMatch;
    
    // Check if it's chapter numbers: "chapter 1 to chapter 3"
    const chapterMatch = startSection.match(/(\w+)\s+(\d+)/i);
    if (chapterMatch) {
      const [__, type, startNum] = chapterMatch;
      const endMatch = endSection.match(/(\d+)/);
      if (endMatch) {
        const endNum = parseInt(endMatch[1]);
        const start = parseInt(startNum);
        for (let i = start; i <= endNum; i++) {
          keywords.push(`${type} ${i}`.toLowerCase());
        }
      }
    } else {
      // It's section names like "introduction to conclusion"
      // Split text into sections and find range
      const sections = text.split(/\n\n+/);
      const startTerm = startSection.trim();
      const endTerm = endSection.trim();
      
      let startIdx = -1;
      let endIdx = -1;
      
      sections.forEach((section, idx) => {
        const sectionLower = section.toLowerCase();
        if (startIdx === -1 && sectionLower.includes(startTerm)) {
          startIdx = idx;
        }
        if (sectionLower.includes(endTerm)) {
          endIdx = idx;
        }
      });
      
      if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
        // Return the range of sections
        return sections.slice(startIdx, endIdx + 1).join('\n\n');
      }
      
      // Fallback: use both as keywords
      keywords.push(startTerm, endTerm);
    }
  } 
  // Pattern 2: Comma-separated keywords
  else if (cleanedInput.includes(',')) {
    keywords = cleanedInput.split(',').map(k => k.trim());
  }
  // Pattern 3: Single keyword or phrase
  else {
    keywords = [cleanedInput];
  }
  
  if (keywords.length === 0) return text;
  
  // Split text into sections (paragraphs)
  const sections = text.split(/\n\n+/);
  
  // Filter sections that contain any of the keywords
  const filteredSections = sections.filter(section => {
    const sectionLower = section.toLowerCase();
    return keywords.some(keyword => sectionLower.includes(keyword));
  });
  
  // If we found matching sections, return them; otherwise return original
  if (filteredSections.length > 0) {
    return filteredSections.join('\n\n');
  }
  
  return text;
}

export default function WrittenText() {
  const navigate = useNavigate();

  const [pastedText, setPastedText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [settings, setSettings] = useState({
    language: "english",
    type: ["mcq"], // ['mcq','tf','fill']
    difficulty: "medium",
    count: 5,
    pageRange: "",
    keywords: "",
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
          disabled={!hasEnoughText || isGeneratingQuiz}
          onClick={() => setShowSettings(true)}
        >
          Create New Quiz
        </button>
      </div>

      {/* Quiz Generation Progress Bar */}
      {isGeneratingQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center">
              {/* Spinner */}
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              
              {/* Title */}
              <h3 className="text-xl font-bold text-gray-800 mb-2">Generating Your Quiz</h3>
              
              {/* Progress message */}
              <p className="text-gray-600 text-center mb-4">{generationProgress}</p>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 h-full rounded-full animate-pulse"></div>
              </div>
              
              <p className="text-sm text-gray-500 mt-4 text-center">
                This may take a few moments...
              </p>
            </div>
          </div>
        </div>
      )}

      <QuizSettingsModal
        open={showSettings}
        values={settings}
        setValues={setSettings}
        onClose={() => setShowSettings(false)}
        showPageRange={false}
        onCreate={async (vals) => {
          setShowSettings(false);
          setIsGeneratingQuiz(true);
          setGenerationProgress("Preparing content...");
          
          try {
            let allTexts = pastedText.trim();
            
            // Apply keyword filter if specified (page range not applicable for pasted text)
            if (vals.keywords && vals.keywords.trim()) {
              setGenerationProgress("Applying filters...");
              console.log('Applying keyword filter:', vals.keywords);
              allTexts = filterTextByKeywords(allTexts, vals.keywords);
            }
            
            // Validate that we still have text after filtering
            if (!allTexts || allTexts.length < MIN_PASTE_CHARS) {
              setIsGeneratingQuiz(false);
              alert('No content found matching your keywords. Please adjust your filter.');
              setShowSettings(true);
              return;
            }
            
            const selectedTypes = Array.isArray(vals.type) ? vals.type : [vals.type];
            const perType = Math.ceil(vals.count / selectedTypes.length);
            let allQuestions = [];

            for (let i = 0; i < selectedTypes.length; i++) {
              const t = selectedTypes[i];
              const questionType = t === "mcq" ? "multiple-choice" : t === "tf" ? "true-false" : "fill-in-blank";
              
              setGenerationProgress(
                `Generating ${questionType} questions (${i + 1}/${selectedTypes.length})...`
              );
              
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

            setGenerationProgress("Finalizing quiz...");

            allQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, vals.count).map((q, i) => ({ ...q, id: i + 1 }));

            setIsGeneratingQuiz(false);
            
            navigate("/dashboard/quiz-preview", {
              state: {
                questions: allQuestions,
                fileNames: [],
                pasted: true,
                settings: { 
                  questionTypes: selectedTypes, 
                  difficulty: vals.difficulty, 
                  count: vals.count,
                  keywords: vals.keywords,
                },
              },
            });
          } catch (e) {
            setIsGeneratingQuiz(false);
            alert(e.message || "Failed to generate quiz");
          }
        }}
      />
    </section>
  );
}
