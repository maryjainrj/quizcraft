// quizGenerator.js - AI Quiz Generation Module
const { HfInference } = require('@huggingface/inference');

// Initialize Hugging Face (API key from environment variable)
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

/*| Generate quiz questions from text using Hugging Face AI
 * @param {string} text - Extracted text from document
 * @param {object} settings - Quiz generation settings
 * @returns {Promise<Array>} Generated quiz questions
 */
async function generateQuiz(text, settings = {}) {
  const {
    questionCount = 5,
    questionType = 'multiple-choice',
    difficulty = 'medium',
    language = 'english'
  } = settings;

  console.log('\n AI Quiz Generation Started...');
  console.log(`   Questions: ${questionCount}`);
  console.log(`   Type: ${questionType}`);
  console.log(`   Difficulty: ${difficulty}`);

  try {
    const prompt = createPrompt(text, questionCount, questionType, difficulty, language);
    console.log('Sending request to Hugging Face AI...');
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: prompt,
      parameters: {
        max_new_tokens: 2000,
        temperature: 0.7,
        top_p: 0.95,
        return_full_text: false
      }
    });

    console.log(' AI response received!');
    const questions = parseAIResponse(response.generated_text, questionType);
    console.log(` Successfully parsed ${questions.length} questions`);
    return questions;

  } catch (error) {
    console.error('AI Quiz generation error:', error.message);
    throw error;
  }
}

function createPrompt(text, count, type, difficulty, language) {
  const truncatedText = text.slice(0, 3000);

  let instruction = '';
  let example = '';

  if (type === 'multiple-choice') {
    instruction = `Create ${count} multiple-choice questions with EXACTLY 4 options (A, B, C, D). One correct answer.`;
    example = `Q1: What is the capital of France?
A) Berlin
B) Madrid
C) Paris
D) London
ANSWER: C`;
  } else if (type === 'true-false') {
    instruction = `Create ${count} True/False questions. Answer must be TRUE or FALSE only.`;
    example = `Q1: The Earth is flat.
ANSWER: FALSE

Q2: Water boils at 100°C at sea level.
ANSWER: TRUE`;
  } else if (type === 'fill-in-blank') {
    instruction = `Create ${count} fill-in-the-blank questions. Provide the exact word/phrase for the blank.`;
    example = `Q1: The capital of France is _____.
ANSWER: Paris

Q2: Plants make food through _____.
ANSWER: photosynthesis`;
  }

  return `You are a quiz creator. Generate EXACTLY ${count} questions of type "${type}".

CONTENT:
${truncatedText}

INSTRUCTIONS:
- ${instruction}
- Base answers strictly on the content
- DO NOT add extra text
- Follow format EXACTLY

FORMAT:
${example}

OUTPUT ONLY THE QUESTIONS AND ANSWERS. NO EXTRA TEXT.`;
}

function parseAIResponse(aiText, questionType) {
  const questions = [];
  const lines = aiText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentQ = null;

  for (let line of lines) {
    if (/^Q\d+:/.test(line)) {
      if (currentQ) questions.push(currentQ);
      currentQ = {
        id: questions.length + 1,
        question: line.replace(/^Q\d+:\s*/, ''),
        type: questionType,
        options: [],
        correctAnswer: ''
      };
    }
    else if (/^[A-D]\)/.test(line) && currentQ && questionType === 'multiple-choice') {
      currentQ.options.push(line.replace(/^[A-D]\)\s*/, ''));
    }
    else if (line.startsWith('ANSWER:')) {
      const answer = line.replace('ANSWER:', '').trim();
      if (currentQ) {
        if (questionType === 'multiple-choice') {
          currentQ.correctAnswer = answer;
        } else if (questionType === 'true-false') {
          currentQ.correctAnswer = answer.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
        } else if (questionType === 'fill-in-blank') {
          currentQ.correctAnswer = answer;
        }
      }
    }
  }

  if (currentQ) questions.push(currentQ);

  // CLEANUP: Remove options for non-MCQ
  return questions.map(q => {
    if (q.type !== 'multiple-choice') {
      q.options = [];  // Explicitly clear
      delete q.options;
    }
    if (!q.correctAnswer) {
      if (q.type === 'true-false') q.correctAnswer = 'TRUE';
      else if (q.type === 'fill-in-blank') q.correctAnswer = '______';
    }
    return q;
  });
}

function generateFallbackQuestions(text, count) {
  console.log('Generating fallback questions...');
  const sentences = text
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 20)
    .map(s => s.trim());
  
  const questions = [];
  for (let i = 0; i < Math.min(count, sentences.length, 10); i++) {
    const sentence = sentences[i];
    const words = sentence.split(' ').filter(w => w.length > 4);
    if (words.length === 0) continue;
    const keyword = words[Math.floor(Math.random() * words.length)];
    
    questions.push({
      id: i + 1,
      question: `What information is provided about "${keyword}"?`,
      options: [
        `Details about ${keyword}`,
        'This topic is not covered',
        'A different subject entirely',
        'Cannot be determined from the text'
      ],
      correctAnswer: 'A',
      type: 'multiple-choice'
    });
  }
  
  if (questions.length === 0) {
    questions.push({
      id: 1,
      question: 'What is the main topic of this content?',
      options: [
        'The content discusses the provided information',
        'Unrelated topic',
        'No clear topic',
        'Multiple unrelated topics'
      ],
      correctAnswer: 'A',
      type: 'multiple-choice'
    });
  }
  
  console.log(` Generated ${questions.length} fallback questions`);
  return questions;
}

module.exports = {
  generateQuiz,
  generateFallbackQuestions
};