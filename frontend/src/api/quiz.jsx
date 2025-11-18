const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export const generateQuiz = async (text, settings) => {
  const res = await fetch(`${API_BASE}/api/generate-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, settings })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to generate quiz');
  }
  return res.json(); // → { questions: [...] }
};