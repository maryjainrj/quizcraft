// quizGenerator.js - AI Quiz Generation Module
const { HfInference } = require('@huggingface/inference');

// Initialize Hugging Face (API key from environment variable)
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

/**
 * Generate quiz questions from text using Hugging Face AI
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

  console.log('\nAI Quiz Generation Started...');
  console.log(`   Questions: ${questionCount}`);
  console.log(`   Type: ${questionType}`);
  console.log(`   Difficulty: ${difficulty}`);

  try {
    const prompt = createPrompt(text, questionCount, questionType, difficulty, language);
    console.log('Sending request to Hugging Face AI...');
    
    // Use chatCompletion instead of textGeneration for Mistral models
    const response = await hf.chatCompletion({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
      top_p: 0.95
    });

    console.log('AI response received!');
    const generatedText = response.choices[0].message.content;
    const questions = parseAIResponse(generatedText, questionType);
    console.log(`✨ Successfully parsed ${questions.length} questions`);
    
    // If we got fewer questions than requested, try fallback
    if (questions.length < questionCount) {
      console.log(`Only got ${questions.length}/${questionCount} questions, adding fallback...`);
      const fallbackNeeded = questionCount - questions.length;
      const fallbackQuestions = generateFallbackQuestions(text, fallbackNeeded, questionType);
      return [...questions, ...fallbackQuestions];
    }
    
    return questions.slice(0, questionCount);

  } catch (error) {
    console.error('AI Quiz generation error:', error.message);
    console.log('Falling back to rule-based generation...');
    return generateFallbackQuestions(text, questionCount, questionType);
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
ANSWER: C

Q2: Which planet is closest to the Sun?
A) Venus
B) Mercury
C) Mars
D) Earth
ANSWER: B`;
  } else if (type === 'true-false') {
    instruction = `Create ${count} True/False questions. Answer must be TRUE or FALSE only.`;
    example = `Q1: The Earth is flat.
ANSWER: FALSE

Q2: Water boils at 100°C at sea level.
ANSWER: TRUE

Q3: The Sun is a planet.
ANSWER: FALSE`;
  } else if (type === 'fill-in-blank') {
    instruction = `Create ${count} fill-in-the-blank questions. Provide the exact word/phrase for the blank.`;
    example = `Q1: The capital of France is _____.
ANSWER: Paris

Q2: Plants make food through _____.
ANSWER: photosynthesis

Q3: The Earth orbits around the _____.
ANSWER: Sun`;
  }

  return `You are a quiz creator. Generate EXACTLY ${count} questions of type "${type}" based on the content below.

CONTENT:
${truncatedText}

INSTRUCTIONS:
- ${instruction}
- Base all questions and answers strictly on the provided content
- DO NOT add any extra text, explanations, or commentary
- Follow the format EXACTLY as shown in the example
- Each question must be numbered (Q1:, Q2:, etc.)
- Each answer must start with "ANSWER:"

FORMAT EXAMPLE:
${example}

Now generate ${count} questions following this exact format:`;
}

function parseAIResponse(aiText, questionType) {
  const questions = [];
  const lines = aiText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentQ = null;

  for (let line of lines) {
    // Match question lines: Q1:, Q2:, etc.
    if (/^Q\d+:/i.test(line)) {
      if (currentQ && currentQ.question) {
        questions.push(currentQ);
      }
      currentQ = {
        id: questions.length + 1,
        question: line.replace(/^Q\d+:\s*/i, '').trim(),
        type: questionType,
        options: [],
        correctAnswer: ''
      };
    }
    // Match options for multiple-choice: A), B), C), D)
    else if (/^[A-D][\)\.]/.test(line) && currentQ && questionType === 'multiple-choice') {
      const option = line.replace(/^[A-D][\)\.]\s*/, '').trim();
      if (option) {
        currentQ.options.push(option);
      }
    }
    // Match answer lines
    else if (/^ANSWER:/i.test(line)) {
      const answer = line.replace(/^ANSWER:\s*/i, '').trim();
      if (currentQ) {
        if (questionType === 'multiple-choice') {
          // Extract just the letter (A, B, C, or D)
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

  // Don't forget the last question
  if (currentQ && currentQ.question) {
    questions.push(currentQ);
  }

  // Clean up and validate questions
  return questions.filter(q => {
    // Must have a question
    if (!q.question) return false;
    
    // Multiple-choice must have at least 2 options
    if (q.type === 'multiple-choice' && q.options.length < 2) return false;
    
    // Must have an answer
    if (!q.correctAnswer) return false;
    
    return true;
  }).map(q => {
    // Remove options field for non-MCQ
    if (q.type !== 'multiple-choice') {
      delete q.options;
    }
    return q;
  });
}

function generateFallbackQuestions(text, count, type = 'multiple-choice') {
  console.log(`🔧 Generating ${count} fallback questions (${type})...`);
  
  const sentences = text
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 20 && s.trim().length < 200)
    .map(s => s.trim())
    .slice(0, count * 3);
  
  const questions = [];
  
  for (let i = 0; i < Math.min(count, sentences.length); i++) {
    const sentence = sentences[i];
    
    if (type === 'multiple-choice') {
      const words = sentence.split(' ').filter(w => w.length > 4);
      const keyword = words[Math.floor(words.length / 2)] || 'topic';
      
      questions.push({
        id: questions.length + 1,
        question: `According to the text, what is mentioned about ${keyword.toLowerCase()}?`,
        type: 'multiple-choice',
        options: [
          sentence.substring(0, 60) + (sentence.length > 60 ? '...' : ''),
          'This information is not provided',
          'The opposite statement is made',
          'No relevant details are given'
        ],
        correctAnswer: 'A'
      });
    } else if (type === 'true-false') {
      questions.push({
        id: questions.length + 1,
        question: sentence,
        type: 'true-false',
        correctAnswer: 'TRUE'
      });
    } else if (type === 'fill-in-blank') {
      const words = sentence.split(' ').filter(w => w.length > 3);
      if (words.length > 0) {
        const blankIndex = Math.floor(words.length / 2);
        const answer = words[blankIndex];
        const sentenceWords = sentence.split(' ');
        const actualIndex = sentenceWords.findIndex(w => w.includes(answer));
        if (actualIndex !== -1) {
          sentenceWords[actualIndex] = '_____';
        }
        
        questions.push({
          id: questions.length + 1,
          question: sentenceWords.join(' '),
          type: 'fill-in-blank',
          correctAnswer: answer.replace(/[^\w\s]/g, '')
        });
      }
    }
  }
  
  // Ensure we have at least one question
  if (questions.length === 0) {
    questions.push({
      id: 1,
      question: 'What is the main topic discussed in this content?',
      type: 'multiple-choice',
      options: [
        'The content discusses the information provided',
        'An unrelated topic',
        'No clear topic is presented',
        'Multiple unrelated subjects'
      ],
      correctAnswer: 'A'
    });
  }
  
  console.log(`Generated ${questions.length} fallback questions`);
  return questions;
}

module.exports = {
  generateQuiz,
  generateFallbackQuestions
};