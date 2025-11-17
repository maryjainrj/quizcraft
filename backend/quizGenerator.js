// quizGenerator.js - AI Quiz Generation Module
const { HfInference } = require('@huggingface/inference');

// Initialize Hugging Face (API key from environment variable)
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const CHAT_MODEL = process.env.HF_CHAT_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

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
    // Extract math snippets to bias the model and power fallbacks
    const eqs = extractEquations(text);

    const prompt = createPrompt(text, questionCount, questionType, difficulty, language);
    console.log('Sending request to Hugging Face AI...');
    
    // Use chatCompletion instead of textGeneration for Mistral models
    const response = await hf.chatCompletion({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
      top_p: 0.9
    });

    console.log('AI response received!');
    const generatedText = response.choices[0].message.content;
    const questions = parseAIResponse(generatedText, questionType);
    console.log(`✨ Successfully parsed ${questions.length} questions`);

    // Remove low-value generic comprehension questions
    const pruned = filterGenericQuestions(questions);
    if (pruned.length !== questions.length) {
      console.log(`🧹 Removed ${questions.length - pruned.length} generic comprehension questions`);
    }
    
    // If we got fewer questions than requested, try fallback
    if (pruned.length < questionCount) {
      console.log(`Only got ${pruned.length}/${questionCount} questions after pruning, adding fallback...`);
      const fallbackNeeded = questionCount - pruned.length;
      // Prefer math-based fallback from extracted equations
      const mathFallback = generateMathFromEquations(eqs, fallbackNeeded, questionType) || [];
      const stillNeed = fallbackNeeded - mathFallback.length;
      const genericFallback = stillNeed > 0 ? generateFallbackQuestions(text, stillNeed, questionType) : [];
      const fallbackQuestions = [...mathFallback, ...genericFallback];
      return [...pruned, ...fallbackQuestions];
    }
    
    return pruned.slice(0, questionCount);

  } catch (error) {
    console.error('AI Quiz generation error:', error.message);
    console.log('Falling back to rule-based generation...');
    const eqs = extractEquations(text);
    const mathFallback = generateMathFromEquations(eqs, questionCount, questionType);
    if (mathFallback && mathFallback.length) return mathFallback;
    return generateFallbackQuestions(text, questionCount, questionType);
  }
}

function createPrompt(text, count, type, difficulty, language) {
  const truncatedText = text.slice(0, 8000);
  const eqs = extractEquations(truncatedText);

  let instruction = '';
  let example = '';

  if (type === 'multiple-choice') {
    instruction = `Create ${count} multiple-choice questions with EXACTLY 4 options (A, B, C, D). One correct answer.`;
    example = `Q1: Solve the linear equation $2x + 3 = 7$. What is $x$?
A) $x = 1$
B) $x = 2$
C) $x = 3$
D) $x = 4$
ANSWER: B

Q2: What is the capital of France?
A) Berlin
B) Madrid
C) Paris
D) London
ANSWER: C

Q3: Which planet is closest to the Sun?
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

EXTRACTED_EQUATIONS_AND_MATH (use these FIRST if present):
${[...eqs.latex, ...eqs.linear, ...eqs.inequalities, ...eqs.arithmetic].slice(0, 50).map((e,i)=>`${i+1}) ${e}`).join('\n') || '(none found)'}

INSTRUCTIONS:
- ${instruction}
- Base all questions and answers strictly on the provided content
- DO NOT add any extra text, explanations, or commentary
- Follow the format EXACTLY as shown in the example
- Each question must be numbered (Q1:, Q2:, etc.)
- Each answer must start with "ANSWER:"
 - Include questions that involve solving the given linear equations and inequalities
 - Preserve math expressions exactly as LaTeX (use $...$, \\(...\\), or $$...$$)
 - When a question or an option contains an equation or inequality, wrap it in LaTeX
 - DO NOT create questions from headings, bullet points, or learning objectives alone
 - Prefer numeric problems like 1+1=?, simple linear equations ax+b=c, and basic inequalities from the content

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

  // 1) Try math-centric fallback from extraction first (again)
  const eqs = extractEquations(text || '');
  const math = generateMathFromEquations(eqs, count, type);
  if (math && math.length) {
    console.log(`Generated ${math.length} math fallback questions`);
    return math;
  }

  // 2) Build simple arithmetic from numbers present in the text
  const numbers = Array.from(String(text || '').matchAll(/\b\d+(?:\.\d+)?\b/g)).map(m => parseFloat(m[0]));
  const pairs = [];
  for (let i = 0; i + 1 < numbers.length && pairs.length < count * 2; i += 2) {
    pairs.push([numbers[i], numbers[i + 1]]);
  }

  const questions = [];
  for (let i = 0; i < Math.min(count, pairs.length); i++) {
    const [a, b] = pairs[i];
    const ops = ['+', '-', '*'];
    const op = ops[i % ops.length];
    let val;
    switch (op) {
      case '+': val = a + b; break;
      case '-': val = a - b; break;
      case '*': val = a * b; break;
    }
    const correct = formatNumber(val);
    const distractors = [formatNumber(val + 1), formatNumber(val - 1), formatNumber(val * 2)];
    const options = shuffle([correct, ...distractors]).slice(0, 4);
    const letters = ['A', 'B', 'C', 'D'];
    const correctIndex = options.findIndex(o => o === correct);
    questions.push({
      id: questions.length + 1,
      question: `Compute $${formatNumber(a)} ${op} ${formatNumber(b)}$`,
      type: 'multiple-choice',
      options,
      correctAnswer: letters[correctIndex] || 'A'
    });
  }

  // 3) If still nothing, generate a couple of fixed arithmetic items
  while (questions.length < count) {
    const a = 1 + questions.length;
    const b = 1;
    const val = a + b;
    const correct = formatNumber(val);
    const distractors = [formatNumber(val + 1), formatNumber(val - 1), formatNumber(val * 2)];
    const options = shuffle([correct, ...distractors]).slice(0, 4);
    const letters = ['A', 'B', 'C', 'D'];
    const correctIndex = options.findIndex(o => o === correct);
    questions.push({
      id: questions.length + 1,
      question: `Compute $${a} + ${b}$`,
      type: 'multiple-choice',
      options,
      correctAnswer: letters[correctIndex] || 'A'
    });
  }

  console.log(`Generated ${questions.length} arithmetic fallback questions`);
  return questions.slice(0, count);
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

  // Simple arithmetic like 12 + 5, 3*4, 7 - 2, 9 / 3
  const arithRe = /\b\d+(?:\.\d+)?\s*[+\-*\/]\s*\d+(?:\.\d+)?\b/g;
  let am;
  while ((am = arithRe.exec(text)) !== null) {
    arithmetic.add(am[0].replace(/\s+/g, ' ').trim());
  }

  // Linear equations a v + b = c (v is any single-letter variable)
  const linearRe = /([+-]?\d*\.?\d*)\s*[a-zA-Z]\s*([+\-]\s*\d+\.?\d*)?\s*=\s*[+-]?\d+\.?\d*/gi;
  let lm;
  while ((lm = linearRe.exec(text)) !== null) {
    linear.add(lm[0].replace(/\s+/g, ' ').trim());
  }

  // Inequalities a v + b (<=|>=|<|>) c, where v is any single-letter variable
  const ineqRe = /([+-]?\d*\.?\d*)\s*([a-zA-Z])\s*([+\-]\s*\d+\.?\d*)?\s*(<=|>=|<|>)\s*[+\-]?\d+\.?\d*/gi;
  let im;
  while ((im = ineqRe.exec(text)) !== null) {
    inequalities.add(im[0].replace(/\s+/g, ' ').trim());
  }

  // Generic linear-looking equations possibly with parentheses: capture and let solver validate later
  const genericEqRe = /[0-9a-zA-Z\s+\-*/()]+=[0-9a-zA-Z\s+\-*/()]+/g;
  let gm;
  while ((gm = genericEqRe.exec(text)) !== null) {
    const expr = gm[0].trim();
    if (/[a-zA-Z]/.test(expr)) {
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