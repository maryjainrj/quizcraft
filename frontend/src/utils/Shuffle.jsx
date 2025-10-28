// src/utils/shuffle.js
export const shuffleOptions = (question) => {
  if (question.type !== "multiple-choice" || !question.options || !question.correctAnswer) {
    return question; // No shuffle for non-MCQ
  }

  const options = [...question.options];
  const correctAnswer = question.correctAnswer; // e.g., "B"
  const correctIndex = correctAnswer.charCodeAt(0) - 65; // B → 1
  const correctText = options[correctIndex];

  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  // Find new position of correct answer
  const newCorrectIndex = options.indexOf(correctText);
  const newCorrectLetter = String.fromCharCode(65 + newCorrectIndex); // e.g., "C"

  return {
    ...question,
    options,
    correctAnswer: newCorrectLetter,
  };
};