import React, { useMemo } from "react";
import "./QuizSettingsModal.css";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export default function QuizSettingsModal({
  open,
  onClose,
  onCreate,
  values,
  setValues,
}) {
  if (!open) return null;

  const min = 6;
  const max = 30;
  const pct = useMemo(() => {
    const p = ((values.count - min) / (max - min)) * 100;
    return `${clamp(p, 0, 100)}%`;
  }, [values.count]);

  return (
    <div className="qs-overlay" role="dialog" aria-modal="true" aria-labelledby="qs-title">
      <div className="qs-modal">
        <button className="qs-close" aria-label="Close" onClick={onClose}>×</button>

        <h2 id="qs-title" className="qs-heading">Quiz Settings</h2>
        <p className="qs-subheading">Configure your quiz generation conditions.</p>

        {/* Language */}
        <div className="qs-block">
          <label className="qs-label">Language</label>
          {/* read-only single option for now */}
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
          <div className="qs-label">Question Type</div>
          <div className="qs-options">
            {[
              { value: "fill", label: "Fill in the Blanks" },
              { value: "mcq", label: "Multiple Choice" },
              { value: "tf", label: "True or False" },
            ].map((opt) => (
              <label key={opt.value} className={`qs-option ${values.type === opt.value ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="qtype"
                  value={opt.value}
                  checked={values.type === opt.value}
                  onChange={(e) => setValues((s) => ({ ...s, type: e.target.value }))}
                />
                <span className="qs-radio" aria-hidden="true" />
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

        {/* Range: 6..30 */}
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
              // purple left track up to thumb
              background: `linear-gradient(90deg, #4b1fb5 ${pct}, #d1d5db ${pct})`,
            }}
          />
          <div className="qs-range-value">Selected: {values.count}</div>
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
