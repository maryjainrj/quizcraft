import React, { useMemo } from "react";
import "./QuizSettingsModal.css";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export default function QuizSettingsModal({
  open,
  onClose,
  onCreate,
  values,
  setValues,
  showPageRange = true, // Allow hiding page range for pasted text
}) {
  if (!open) return null;

  const min = 6;
  const max = 30;
  const pct = useMemo(() => {
    const p = ((values.count - min) / (max - min)) * 100;
    return `${clamp(p, 0, 100)}%`;
  }, [values.count]);

  // Initialize filters if not present
  React.useEffect(() => {
    if (!values.pageRange) {
      setValues(prev => ({ ...prev, pageRange: '' }));
    }
    if (!values.keywords) {
      setValues(prev => ({ ...prev, keywords: '' }));
    }
  }, []);

  // Keep numeric page inputs in sync with `pageRange` string so callers
  // (UploadFiles.jsx) that expect `pageRange` receive the selected range.
  React.useEffect(() => {
    const pf = values.pageFrom;
    const pt = values.pageTo;

    if ((pf || pf === 0) && (pt || pt === 0)) {
      const range = `${pf}-${pt}`;
      if (values.pageRange !== range) {
        setValues((s) => ({ ...s, pageRange: range }));
      }
    } else if (!pf && !pt && values.pageRange) {
      // Clear pageRange when numeric inputs are cleared
      setValues((s) => ({ ...s, pageRange: '' }));
    }
  }, [values.pageFrom, values.pageTo]);

  // Handle checkbox toggle for multiple question types
  const handleTypeToggle = (typeValue) => {
    setValues((s) => {
      const currentTypes = Array.isArray(s.type) ? s.type : [s.type];
      const isSelected = currentTypes.includes(typeValue);

      let newTypes;
      if (isSelected) {
        newTypes = currentTypes.filter((t) => t !== typeValue);
        if (newTypes.length === 0) newTypes = [typeValue]; // keep at least one
      } else {
        newTypes = [...currentTypes, typeValue];
      }

      return { ...s, type: newTypes };
    });
  };

  const selectedTypes = Array.isArray(values.type) ? values.type : [values.type];

  const hasKeyword = Boolean((values.keywords || "").trim());
  const hasRange =
    (values.pageFrom || values.pageFrom === 0) &&
    (values.pageTo || values.pageTo === 0);

  return (
    <div className="qs-overlay" role="dialog" aria-modal="true" aria-labelledby="qs-title">
      <div className="qs-modal">
        <button className="qs-close" aria-label="Close" onClick={onClose}>×</button>

        <h2 id="qs-title" className="qs-heading">Quiz Settings</h2>
        <p className="qs-subheading">
          Configure your quiz generation conditions. You can select multiple question types.
        </p>

        {/* Language */}
        <div className="qs-block">
          <label className="qs-label">Language</label>
          <input
            type="text"
            className="qs-input"
            value="English"
            readOnly
            aria-readonly="true"
          />
        </div>

        {/* Question Type */}
        <div className="qs-block">
          <div className="qs-label">Question Type (Select one or more)</div>
          <div className="qs-options">
            {[
              { value: "fill", label: "Fill in the Blanks" },
              { value: "mcq", label: "Multiple Choice" },
              { value: "tf", label: "True or False" },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`qs-option ${selectedTypes.includes(opt.value) ? "is-selected" : ""}`}
              >
                <input
                  type="checkbox"
                  name="qtype"
                  value={opt.value}
                  checked={selectedTypes.includes(opt.value)}
                  onChange={() => handleTypeToggle(opt.value)}
                />
                <span className="qs-checkbox" aria-hidden="true">
                  {selectedTypes.includes(opt.value) && <span className="qs-checkmark">✓</span>}
                </span>
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Question Difficulty */}
        <div className="qs-block">
          <div className="qs-label">Question Difficulty</div>
          <div className="qs-options">
            {[
              { value: "easy", label: "Easy Questions" },
              { value: "medium", label: "Medium Questions" },
              { value: "hard", label: "Hard Questions" },
            ].map((opt) => (
              <label key={opt.value} className={`qs-option ${values.difficulty === opt.value ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="qdifficulty"
                  value={opt.value}
                  checked={values.difficulty === opt.value}
                  onChange={(e) => setValues((s) => ({ ...s, difficulty: e.target.value }))}
                />
                <span className="qs-radio" aria-hidden="true" />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Optional filters: Keywords full width; page range compact on one line */}
        <div className="qs-block">
          <label className="qs-label">Optional Filters for Content</label>

          {/* Keywords – full width */}
          <div className="qs-field">
            <label className="qs-sublabel" htmlFor="qs-keywords">
              Keyword Hints (optional)
            </label>
            <input
              id="qs-keywords"
              type="text"
              className="qs-input"
              placeholder="e.g., Renaissance art; Luther; printing press"
              value={values.keywords ?? ""}
              onChange={(e) => setValues(s => ({ ...s, keywords: e.target.value }))}
            />
          </div>

            {/* Page range – compact single row (hidden for pasted text flows) */}
            {showPageRange && (
              <div className="qs-field">
                <label className="qs-sublabel">Page range (optional)</label>
                <div className="qs-inline-range">
                  <div className="qs-range-item">
                    <span className="qs-inline-label">From</span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="qs-input qs-input--num"
                      placeholder="3"
                      value={values.pageFrom ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return setValues(s => ({ ...s, pageFrom: "" }));
                        const n = parseInt(raw, 10);
                        if (!Number.isNaN(n) && n >= 1) setValues(s => ({ ...s, pageFrom: n }));
                      }}
                      aria-label="Page from"
                    />
                  </div>

                  <span className="qs-inline-dash">—</span>

                  <div className="qs-range-item">
                    <span className="qs-inline-label">To</span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="qs-input qs-input--num"
                      placeholder="12"
                      value={values.pageTo ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return setValues(s => ({ ...s, pageTo: "" }));
                        const n = parseInt(raw, 10);
                        if (!Number.isNaN(n) && n >= 1) setValues(s => ({ ...s, pageTo: n }));
                      }}
                      aria-label="Page to"
                    />
                  </div>
                </div>

                <p className="qs-hint">
                  Leave blank to include all pages. If both provided, the generator should prefer that range.
                </p>
              </div>
            )}

          {(hasKeyword || hasRange) && (
            <div className="qs-filter-preview">
              <strong>Will apply:</strong>{" "}
              {hasKeyword && <>keywords: "{values.keywords}"</>}
              {hasKeyword && hasRange && " · "}
              {hasRange && <>pages: {values.pageFrom}–{values.pageTo}</>}
            </div>
          )}
        </div>

        {/* Focus Area */}
        <div className="qs-block">
          <div className="qs-label">Focus Area</div>
          <div className="qs-options">
            {[
              { value: "general", label: "General (Balanced)" },
              { value: "definitions", label: "Definitions & Terms" },
              { value: "concepts", label: "Concepts & Ideas" },
              { value: "facts", label: "Facts & Details" },
              { value: "applications", label: "Applications" },
            ].map((opt) => (
              <label key={opt.value} className={`qs-option ${values.focusArea === opt.value ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="focusArea"
                  value={opt.value}
                  checked={values.focusArea === opt.value}
                  onChange={(e) => setValues((s) => ({ ...s, focusArea: e.target.value }))}
                />
                <span className="qs-radio" aria-hidden="true" />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Answer Format */}
        <div className="qs-block">
          <div className="qs-label">Answer Format</div>
          <div className="qs-options">
            {[
              { value: "brief", label: "Brief Answers" },
              { value: "detailed", label: "Detailed Explanations" },
            ].map((opt) => (
              <label key={opt.value} className={`qs-option ${values.answerFormat === opt.value ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="answerFormat"
                  value={opt.value}
                  checked={values.answerFormat === opt.value}
                  onChange={(e) => setValues((s) => ({ ...s, answerFormat: e.target.value }))}
                />
                <span className="qs-radio" aria-hidden="true" />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Exclude Topics */}
        <div className="qs-block">
          <label className="qs-label">Exclude Topics (optional)</label>
          <div className="qs-field">
            <input
              type="text"
              className="qs-input"
              placeholder="e.g., introduction, chapter 1, summary"
              value={values.excludeTopics ?? ""}
              onChange={(e) => setValues(s => ({ ...s, excludeTopics: e.target.value }))}
            />
            <p className="qs-hint">
              Comma-separated list of topics to avoid in questions
            </p>
          </div>
        </div>

        {/* Number of questions (Range): 6..30 */}
        <div className="qs-block">
          <div className="qs-range-labels">
            <span>Minimum 6 Questions</span>
            <span>Maximum 30 Questions</span>
          </div>

          <input
            type="range"
            min={6}
            max={30}
            value={values.count}
            onChange={(e) => setValues((s) => ({ ...s, count: Number(e.target.value) }))}
            className="qs-range"
            style={{
              background: `linear-gradient(90deg, #4b1fb5 ${pct}, #d1d5db ${pct})`,
            }}
          />
          <div className="qs-range-value">
            Selected: {values.count} question{values.count !== 1 ? "s" : ""}
            {selectedTypes.length > 1 && ` (${Math.ceil(values.count / selectedTypes.length)} per type)`}
          </div>
        </div>

        {/* Actions */}
        <div className="qs-actions">
          <button className="qs-btn qs-btn--ghost" onClick={onClose}>
            Back to Quiz
          </button>
          <button
            className="qs-btn qs-btn--primary"
            onClick={() => onCreate?.(values)}
          >
            Create New Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
