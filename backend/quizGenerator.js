// quizGenerator.js - Hugging Face with Reliable Models
const { HfInference } = require('@huggingface/inference');

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Try these models in order until one works
const MODELS_TO_TRY = [
  'meta-llama/Llama-3.2-3B-Instruct',
  'microsoft/Phi-3-mini-4k-instruct',
  'google/flan-t5-large',
  'HuggingFaceH4/zephyr-7b-beta',
];

async function generateQuiz(text, settings = {}) {
  const {
    questionCount = 5,
    questionType = 'multiple-choice',
    difficulty = 'medium',
    language = 'english'
  } = settings;

  console.log('\n=== AI Quiz Generation Started ===');
  console.log(`   Questions: ${questionCount}`);
  console.log(`   Type: ${questionType}`);
  console.log(`   API Key present: ${!!process.env.HUGGINGFACE_API_KEY}`);

  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error('❌ Missing HUGGINGFACE_API_KEY');
    return generateFallbackQuestions(text, questionCount, questionType)
      .map(q => ({ ...q, source: 'fallback' }));
  }

  // Try each model until one works
  for (const model of MODELS_TO_TRY) {
    try {
      console.log(`\n📤 Trying model: ${model}`);
      const prompt = createPrompt(text, questionCount, questionType, difficulty, language);
      
      const response = await hf.chatCompletion({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      });

      console.log(`✅ Success with model: ${model}`);
      const generatedText = response.choices[0].message.content;
      let questions = parseAIResponse(generatedText, questionType);
      questions = questions.map(q => ({ ...q, source: 'ai' }));

      console.log(`✅ Parsed ${questions.length} AI questions`);

      if (questions.length < questionCount) {
        console.log(`⚠️  Adding ${questionCount - questions.length} fallback questions`);
        const fallbackNeeded = questionCount - questions.length;
        const fallbackQuestions = generateFallbackQuestions(text, fallbackNeeded, questionType)
          .map(q => ({ ...q, source: 'fallback' }));
        return [...questions, ...fallbackQuestions];
      }

      return questions.slice(0, questionCount);

    } catch (error) {
      console.error(`❌ Model ${model} failed: ${error.message}`);
      // Continue to next model
    }
  }

  // All models failed
  console.error('❌ All AI models failed, using fallback generation');
  return generateFallbackQuestions(text, questionCount, questionType)
    .map(q => ({ ...q, source: 'fallback' }));
}

function createPrompt(text, count, type, difficulty, language) {
  const truncatedText = text.slice(0, 3000);

  let instruction = '';
  let example = '';

  if (type === 'multiple-choice') {
    instruction = `Create ${count} multiple-choice questions with EXACTLY 4 options (A, B, C, D).`;
    example = `Q1: What is the capital of France?
A) Berlin
B) Madrid
C) Paris
D) London
ANSWER: C

Q2: Which planet is closest to the Sun?
A) Venus
B) Mercury
C) Mars
D) Earth
ANSWER: B`;
  } else if (type === 'true-false') {
    instruction = `Create ${count} True/False questions.`;
    example = `Q1: The Earth is flat.
ANSWER: FALSE

Q2: Water boils at 100°C at sea level.
ANSWER: TRUE`;
  } else if (type === 'fill-in-blank') {
    instruction = `Create ${count} fill-in-the-blank questions.`;
    example = `Q1: The capital of France is _____.
ANSWER: Paris

Q2: Plants make food through _____.
ANSWER: photosynthesis`;
  }

  return `Generate EXACTLY ${count} quiz questions based on this content:

${truncatedText}

${instruction}

Follow this format exactly:
${example}

Generate ${count} questions now:`;
}

function parseAIResponse(aiText, questionType) {
  const questions = [];
  const lines = aiText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentQ = null;

  for (let line of lines) {
    if (/^Q\d+:/i.test(line)) {
      if (currentQ && currentQ.question) questions.push(currentQ);
      currentQ = {
        id: questions.length + 1,
        question: line.replace(/^Q\d+:\s*/i, '').trim(),
        type: questionType,
        options: [],
        correctAnswer: ''
      };
    }
    else if (/^[A-D][\)\.]/.test(line) && currentQ && questionType === 'multiple-choice') {
      const option = line.replace(/^[A-D][\)\.]\s*/, '').trim();
      if (option) currentQ.options.push(option);
    }
    else if (/^ANSWER:/i.test(line)) {
      const answer = line.replace(/^ANSWER:\s*/i, '').trim();
      if (currentQ) {
        if (questionType === 'multiple-choice') {
          const match = answer.match(/^([A-D])/i);
          currentQ.correctAnswer = match ? match[1].toUpperCase() : answer.charAt(0).toUpperCase();
        } else if (questionType === 'true-false') {
          currentQ.correctAnswer = answer.toUpperCase().includes('TRUE') ? 'TRUE' : 'FALSE';
        } else if (questionType === 'fill-in-blank') {
          currentQ.correctAnswer = answer;
        }
      }
    }
  }

  if (currentQ && currentQ.question) questions.push(currentQ);

  return questions.filter(q => {
    if (!q.question || !q.correctAnswer) return false;
    if (q.type === 'multiple-choice' && q.options.length < 2) return false;
    return true;
  }).map(q => {
    if (q.type !== 'multiple-choice') delete q.options;
    return q;
  });
}

function generateFallbackQuestions(text, count, type = 'multiple-choice') {
  console.log(`🔄 Generating ${count} fallback questions (${type})...`);
  
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200)
    .slice(0, count * 3);

  const questions = [];

  for (let i = 0; i < Math.min(count, sentences.length || 1); i++) {
    const sentence = sentences[i] || "The text discusses a topic.";

    if (type === 'multiple-choice') {
      const words = sentence.split(' ').filter(w => w.length > 4);
      const keyword = words[Math.floor(words.length / 2)] || 'information';

      questions.push({
        id: questions.length + 1,
        question: `According to the text, what is said about "${keyword.replace(/[^\w]/g, '')}"?`,
        type: 'multiple-choice',
        options: [
          sentence.substring(0, 70) + (sentence.length > 70 ? '...' : ''),
          'This is not mentioned',
          'The opposite is stated',
          'No details are provided'
        ],
        correctAnswer: 'A',
        source: 'fallback'
      });
    } else if (type === 'true-false') {
      questions.push({
        id: questions.length + 1,
        question: sentence + '?',
        type: 'true-false',
        correctAnswer: 'TRUE',
        source: 'fallback'
      });
    } else if (type === 'fill-in-blank') {
      const words = sentence.split(' ').filter(w => w.length > 3);
      if (words.length > 0) {
        const blankIndex = Math.floor(words.length / 2);
        const answer = words[blankIndex];
        const modified = sentence.split(' ');
        const actualIndex = modified.findIndex(w => w.toLowerCase().includes(answer.toLowerCase()));
        if (actualIndex !== -1) modified[actualIndex] = '_____';

        questions.push({
          id: questions.length + 1,
          question: modified.join(' '),
          type: 'fill-in-blank',
          correctAnswer: answer.replace(/[^\w\s]/g, '').trim(),
          source: 'fallback'
        });
      }
    }
  }

  if (questions.length === 0) {
    questions.push({
      id: 1,
      question: 'What is the main topic of the provided text?',
      type: 'multiple-choice',
      options: ['The text covers the given content', 'No topic', 'Multiple topics', 'Unknown'],
      correctAnswer: 'A',
      source: 'fallback'
    });
  }

  console.log(`✅ Generated ${questions.length} fallback questions`);
  return questions;
}

module.exports = {
  generateQuiz,
  generateFallbackQuestions
};