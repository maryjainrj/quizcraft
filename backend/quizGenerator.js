// quizGenerator.js - Hugging Face with Reliable Models
const { HfInference } = require('@huggingface/inference');

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const CHAT_MODEL = process.env.HF_CHAT_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

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
    language = 'english',
    focusArea = 'general',
    answerFormat = 'brief',
    excludeTopics = ''
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

function createPrompt(text, count, type, difficulty, language, eqs, hasMathContent, focusArea = 'general', answerFormat = 'brief') {
  const truncatedText = text.slice(0, 3000);

  // Focus area specific instructions
  let focusInstruction = '';
  switch (focusArea) {
    case 'definitions':
      focusInstruction = 'Focus on testing definitions, terminology, and key concepts.';
      break;
    case 'concepts':
      focusInstruction = 'Focus on testing understanding of main ideas and theoretical concepts.';
      break;
    case 'facts':
      focusInstruction = 'Focus on testing factual information, dates, names, and specific details.';
      break;
    case 'applications':
      focusInstruction = 'Focus on testing practical applications and real-world use cases.';
      break;
    default:
      focusInstruction = 'Create balanced questions covering various aspects.';
  }

  // Answer format instruction
  const formatInstruction = answerFormat === 'detailed' 
    ? 'Provide detailed explanations for answers.'
    : 'Keep answers concise and to the point.';

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
  
  // Try math-based fallback first if we have math content
  if (hasMathContent && eqs) {
    const mathQuestions = generateMathFromEquations(eqs, count, type);
    if (mathQuestions && mathQuestions.length >= count) {
      return mathQuestions;
    }
    // If we got some math questions but not enough, add general questions
    if (mathQuestions && mathQuestions.length > 0) {
      const remaining = count - mathQuestions.length;
      const generalQuestions = generateGeneralFallback(text, remaining, type);
      return [...mathQuestions, ...generalQuestions];
    }
  }
  // Otherwise use general text-based fallback
  return generateGeneralFallback(text, count, type);
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

// ===================== Helpers for Math Extraction & Fallback =====================

function extractEquations(text) {
  const latex = new Set();
  const arithmetic = new Set();
  const linear = new Set();
  const inequalities = new Set();

  if (!text) return { latex: [], arithmetic: [], linear: [], inequalities: [] };

  // LaTeX patterns: $...$, \(...\), $$...$$, \[...\]
  const patterns = [
    /\$\$([\s\S]+?)\$\$/g,
    /\$([^$]+)\$/g,
    /\\\(([^)]+)\\\)/g,
    /\\\[([^\]]+)\\\]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const expr = m[1].trim();
      if (expr) latex.add(expr);
    }
  }

  // Simple arithmetic like 12 + 5, 3*4, 7 × 2, 9 ÷ 3
  // Avoid dates/page numbers by requiring spacing around operators or explicit math symbols
  const arithRe = /\b\d+(?:\.\d+)?\s+[+\-×÷]\s+\d+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s*[*\/]\s*\d+(?:\.\d+)?\b/g;
  let am;
  while ((am = arithRe.exec(text)) !== null) {
    const matched = am[0].replace(/\s+/g, ' ').trim();
    // Skip if it looks like a date range or page number (e.g., "2023-2024", "pages 5-10")
    if (!matched.match(/^\d{4}\s*-\s*\d{4}$/) && !text.substring(Math.max(0, am.index - 10), am.index).match(/page|year|between/i)) {
      arithmetic.add(matched);
    }
  }

  // Linear equations a v + b = c (v is any single-letter variable)
  // Must have a variable, operator, and equals sign to be considered an equation
  const linearRe = /([+-]?\d*\.?\d*)\s*[a-zA-Z]\s*([+\-]\s*\d+\.?\d*)?\s*=\s*[+-]?\d+\.?\d*/gi;
  let lm;
  while ((lm = linearRe.exec(text)) !== null) {
    const match = lm[0].replace(/\s+/g, ' ').trim();
    // Must contain both a letter (variable) and equals sign, and not just be "a = b" style definition
    if (match.length > 5 && /\d/.test(match)) {
      linear.add(match);
    }
  }

  // Inequalities a v + b (<=|>=|<|>) c, where v is any single-letter variable
  const ineqRe = /([+-]?\d*\.?\d*)\s*([a-zA-Z])\s*([+\-]\s*\d+\.?\d*)?\s*(<=|>=|<|>)\s*[+\-]?\d+\.?\d*/gi;
  let im;
  while ((im = ineqRe.exec(text)) !== null) {
    inequalities.add(im[0].replace(/\s+/g, ' ').trim());
  }

  // Generic linear-looking equations possibly with parentheses: capture and let solver validate later
  // Only consider if it has a variable AND numbers on both sides of equals
  const genericEqRe = /[0-9]+[a-zA-Z\s+\-*/()]*[a-zA-Z]+[0-9a-zA-Z\s+\-*/()]*=[0-9a-zA-Z\s+\-*/()]+/g;
  let gm;
  while ((gm = genericEqRe.exec(text)) !== null) {
    const expr = gm[0].trim();
    // Must have a variable and numbers on both sides, and reasonable length
    if (expr.length > 4 && expr.length < 50 && /[a-zA-Z]/.test(expr) && /\d/.test(expr.split('=')[0]) && /\d/.test(expr.split('=')[1] || '')) {
      linear.add(expr.replace(/\s+/g, ' ').trim());
    }
  }

  return {
    latex: Array.from(latex),
    arithmetic: Array.from(arithmetic),
    linear: Array.from(linear),
    inequalities: Array.from(inequalities),
  };
}

function generateMathFromEquations(eqs, count, type = 'multiple-choice') {
  if (!eqs) return [];
  const out = [];

  const pushMCQ = (question, correct, distractors = []) => {
    const opts = [correct, ...distractors].slice(0, 4);
    // ensure 4 options by padding
    while (opts.length < 4) opts.push(String(Number(correct) + opts.length));
    // shuffle
    const options = shuffle(opts);
    const letters = ['A', 'B', 'C', 'D'];
    const correctIndex = options.findIndex(o => o === correct);
    out.push({ id: out.length + 1, question, type: 'multiple-choice', options, correctAnswer: letters[correctIndex] || 'A' });
  };

  // Use LaTeX equations first (may include variables like s)
  for (const expr of eqs.latex || []) {
    if (out.length >= count) break;
    const solved = solveLinearAnyVar(expr) || solveLinearGeneral(expr);
    if (!solved) continue;
    const { variable, value } = solved;
    const q = `Solve $${expr}$. What is $${variable}$?`;
    const correct = formatNumber(value);
    const numsInExpr = Array.from(expr.matchAll(/[+\-]?\d+\.?\d*/g)).map(m => m[0]).filter(n => n !== correct);
    const dsBase = [variable, ...numsInExpr.slice(0, 2)];
    const dsPad = dsBase.filter(Boolean);
    while (dsPad.length < 3) dsPad.push(formatNumber(Number(correct) + dsPad.length + 1));
    const ds = dsPad.slice(0, 3);
    pushMCQ(q, correct, ds);
  }

  // Then linear equations detected in plain text
  for (const expr of eqs.linear || []) {
    if (out.length >= count) break;
    const solved = solveLinearAnyVar(expr) || solveLinearGeneral(expr);
    if (solved == null) continue;
    const { variable, value, a, b, c } = solved;
    const lhs = a != null && b != null && c != null
      ? `${a === 1 ? '' : a}${variable} ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}`
      : expr;
    const q = `Solve $${lhs}${a != null && b != null && c != null ? ` = ${c}` : ''}$. What is $${variable}$?`;
    const correct = formatNumber(value);
    const ds = [formatNumber(value + 1), formatNumber(value - 1), variable];
    pushMCQ(q, correct, ds);
  }

  // Then arithmetic
  for (const expr of eqs.arithmetic || []) {
    if (out.length >= count) break;
    const val = evalArithmetic(expr);
    if (val == null) continue;
    const q = `Compute $${expr}$`;
    const correct = formatNumber(val);
    const ds = [formatNumber(val + 1), formatNumber(val - 1), formatNumber(val * 2)];
    pushMCQ(q, correct, ds);
  }

  // Then inequalities (simple ax + b ⋚ c)
  for (const expr of eqs.inequalities || []) {
    if (out.length >= count) break;
    const solved = solveLinearInequality(expr);
    if (!solved) continue;
    const { variable, sign, rhs } = solved;
    const q = `Solve $${expr}$`;
    const correct = `${variable} ${sign} ${formatNumber(rhs)}`;
    const ds = [
      `${variable} ${flip(sign)} ${formatNumber(rhs)}`,
      `${variable} ${sign} ${formatNumber(rhs + 1)}`,
      `${variable} ${sign} ${formatNumber(rhs - 1)}`
    ];
    pushMCQ(q, correct, ds);
  }

  return out.slice(0, count);
}

function solveLinearAnyVar(expr) {
  if (!expr) return null;
  const compact = String(expr).replace(/[\u2212\u2013\u2014]/g, '-').replace(/\s+/g, '');

  // Pattern 1: a v + b = c (variable any single letter)
  let m = compact.match(/^([+\-]?\d*\.?\d*)([a-zA-Z])([+\-]\d+\.?\d*)?=([+\-]?\d+\.?\d*)$/);
  if (m) {
    const variable = m[2];
    let a = m[1] === '' || m[1] === '+' || m[1] === '-' ? (m[1] === '-' ? -1 : 1) : parseFloat(m[1]);
    let b = m[3] ? parseFloat(m[3]) : 0;
    const c = parseFloat(m[4]);
    if (!isFinite(a)) a = 1;
    if (a === 0) return null;
    const value = (c - b) / a;
    return { variable, value, a, b, c };
  }

  // Pattern 2: c = a(v ± b) with parentheses
  m = compact.match(/^([+\-]?\d+\.?\d*)=([+\-]?\d+\.?\d*)\(([a-zA-Z])([+\-])(\d+\.?\d*)\)$/);
  if (m) {
    const c = parseFloat(m[1]);
    const a = parseFloat(m[2]);
    const variable = m[3];
    const sign = m[4];
    const b = parseFloat(m[5]);
    if (a === 0) return null;
    const rhs = c / a;
    const value = sign === '-' ? rhs + b : rhs - b;
    return { variable, value, a, b: sign === '-' ? -b : b, c };
  }

  // Pattern 3: v + b = c (implicit a=1)
  m = compact.match(/^([a-zA-Z])([+\-]\d+\.?\d*)=([+\-]?\d+\.?\d*)$/);
  if (m) {
    const variable = m[1];
    const b = parseFloat(m[2]);
    const c = parseFloat(m[3]);
    const value = (c - b);
    return { variable, value, a: 1, b, c };
  }

  return null;
}

function solveLinearGeneral(expr) {
  try {
    if (!expr) return null;
    let raw = String(expr);
    raw = raw.replace(/[\u2212\u2013\u2014]/g, '-');
    raw = raw.replace(/\\left|\\right/g, '');
    raw = raw.replace(/\\leq/g, '<=');
    raw = raw.replace(/\\geq/g, '>=');
    raw = raw.replace(/\\cdot/g, '*');
    raw = raw.replace(/\$/g, '');
    raw = raw.replace(/\\\(|\\\)/g, '');
    raw = raw.replace(/\\\[|\\\]/g, '');
    raw = raw.replace(/\s+/g, '');
    raw = raw.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

    const eqParts = raw.split('=');
    if (eqParts.length !== 2) return null;

    const variable = detectVariable(raw);
    if (!variable) return null;

    const left = expandLinear(eqParts[0], variable);
    const right = expandLinear(eqParts[1], variable);
    if (!left || !right) return null;
    const A = left.A - right.A;
    const B = left.B - right.B;
    if (!isFinite(A) || A === 0) return null;
    const value = -B / A;
    return { variable, value };
  } catch {
    return null;
  }
}

function detectVariable(s) {
  const m = s.match(/[a-zA-Z]/);
  return m ? m[0] : null;
}

function expandLinear(side, variable) {
  let s = String(side);
  s = s.replace(/([+\-]?\d*\.?\d*)\(\s*([a-zA-Z])\s*([+\-])\s*(\d+\.?\d*)\s*\)/g, (_, k, v, sg, c) => {
    let coef = k === '' || k === '+' || k === '-' ? (k === '-' ? -1 : 1) : parseFloat(k);
    const num = parseFloat(c);
    if (!isFinite(coef) || !isFinite(num)) return _;
    const termVar = `${coef === 1 ? '' : coef}${v}`;
    const termConst = (sg === '-' ? -coef * num : coef * num);
    return `${termVar}${termConst >= 0 ? '+' : ''}${termConst}`;
  });

  s = s.replace(new RegExp(`(${variable})\\/([0-9]+(?:\\.[0-9]+)?)`,'g'), (_, v, d) => {
    const coef = 1 / parseFloat(d);
    return `${coef}${v}`;
  });

  s = s.replace(/\s+/g, '');

  let A = 0, B = 0;
  const varRe = new RegExp(`([+\-]?)(?:((?:\d+)?(?:\.\d+)?))${variable}`,'g');
  let m;
  const used = [];
  while ((m = varRe.exec(s)) !== null) {
    const sign = m[1] === '-' ? -1 : 1;
    const coefStr = m[2];
    const coef = coefStr ? parseFloat(coefStr) : 1;
    A += sign * coef;
    used.push(m[0]);
  }
  for (const t of used) {
    s = s.replace(t, '');
  }
  const numRe = /([+\-]?\d+(?:\.\d+)?)/g;
  let nm;
  while ((nm = numRe.exec(s)) !== null) {
    B += parseFloat(nm[1]);
  }
  return { A, B };
}

function solveLinearInequality(expr) {
  const m = expr.replace(/\s+/g, '').match(/^([+\-]?\d*\.?\d*)([a-zA-Z])([+\-]\d+\.?\d*)?(<=|>=|<|>)([+\-]?\d+\.?\d*)$/i);
  if (!m) return null;
  let a = m[1] === '' || m[1] === '+' || m[1] === '-' ? (m[1] === '-' ? -1 : 1) : parseFloat(m[1]);
  const variable = m[2];
  let b = m[3] ? parseFloat(m[3]) : 0;
  let sign = m[4];
  const c = parseFloat(m[5]);
  if (a === 0) return null;
  // x sign (c - b)/a, flip if a<0
  let rhs = (c - b) / a;
  if (a < 0) sign = flip(sign);
  return { variable, sign, rhs };
}

function flip(s) {
  switch (s) {
    case '<': return '>';
    case '>': return '<';
    case '<=': return '>=';
    case '>=': return '<=';
    default: return s;
  }
}

function evalArithmetic(expr) {
  try {
    // Safe eval for simple a op b
    const m = expr.match(/^(\d+(?:\.\d+)?)\s*([+\-*\/])\s*(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const a = parseFloat(m[1]);
    const op = m[2];
    const b = parseFloat(m[3]);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : null;
      default: return null;
    }
  } catch {
    return null;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(2)).toString();
}

function filterGenericQuestions(list) {
  if (!Array.isArray(list)) return [];
  const bad = /^(according to the text|based on the text|from the passage|per the text|as stated in the text)/i;
  const cleaned = list.filter(q => {
    const t = (q?.question || '').trim();
    return t && !bad.test(t);
  });
  // Also collapse duplicates by question text
  const seen = new Set();
  const unique = [];
  for (const q of cleaned) {
    const key = (q.question || '').toLowerCase();
    if (!seen.has(key)) {
      unique.push(q);
      seen.add(key);
    }
  }
  return unique;
}