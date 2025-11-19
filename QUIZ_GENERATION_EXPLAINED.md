# Quiz Generation System - Complete Explanation

## Overview
QuizCraft now supports **both math-focused AND general knowledge quiz generation** from uploaded documents (PDFs, Word files, images).

---

## Architecture

```
Document Upload (PDF/Word/Image)
         ↓
    OCR Extraction
    (Google Vision)
         ↓
    Text Preprocessing
         ↓
  Content Analysis ←─────┐
  - Detect equations      │
  - Detect general text   │
         ↓                │
    AI Generation         │
    (Hugging Face)        │
  - Math-focused prompts  │
  - Knowledge-based prompts
         ↓                │
  Post-Processing ←───────┘
  - Parse responses
  - Validate questions
  - Filter low-quality
         ↓
  Fallback System
  - Rule-based math
  - Knowledge extraction
  - Arithmetic generation
         ↓
    Final Quiz
```

---

## How It Works

### **1. Content Detection (Smart Routing)**

**File**: `backend/quizGenerator.js` → `createPrompt()`

The system automatically detects content type:

```javascript
const eqs = extractEquations(text);
const hasMathContent = eqs.latex.length > 0 || 
                       eqs.linear.length > 0 || 
                       eqs.inequalities.length > 0;
const hasGeneralContent = text.length > 500 && 
                          text.split(/\s+/).length > 100;
```

**Decision Tree**:
- **Math Content Detected** → Generate equation-solving questions
- **General Content Detected** → Generate comprehension/knowledge questions
- **Mixed Content** → Generate both types

---

### **2. Math-Focused Generation**

#### **Equation Extraction**
Detects and preserves:
- ✅ LaTeX notation: `$x^2 + 5 = 10$`
- ✅ Linear equations: `2x + 5 = 15`
- ✅ Inequalities: `x > 5`, `y ≤ 10`
- ✅ Arithmetic: `15 + 7 = ?`

#### **AI Prompt (Math Example)**
```
Generate 5 multiple-choice questions...

EXTRACTED_EQUATIONS_AND_MATH (use these FIRST):
1) 2x + 5 = 15
2) y - 8 = 12
3) $3x^2 + 5x - 2 = 0$

INSTRUCTIONS:
- Prioritize questions that involve solving equations
- Preserve math expressions exactly as LaTeX
- Create mathematical problems, not comprehension questions
```

#### **Output**
```
Q1: What is the value of x in the equation 2x + 5 = 15?
A) 3
B) 5 ✓
C) 7
D) 10
ANSWER: B
```

---

### **3. General Knowledge Generation**

#### **Content Analysis**
Extracts:
- Key sentences (20-200 characters)
- Important terms (capitalized, repeated)
- Definitions and concepts
- Relationships and implications

#### **AI Prompt (General Knowledge Example)**
```
Generate 5 multiple-choice questions...

CONTENT:
The capital of France is Paris. It is located on the Seine River...
The French Revolution began in 1789...

INSTRUCTIONS:
- Create comprehension, factual, and conceptual questions
- Test understanding of key concepts and definitions
- Include questions about main ideas and supporting details
```

#### **Output**
```
Q1: What is the capital of France?
A) Berlin
B) Madrid
C) Paris ✓
D) London
ANSWER: C

Q2: When did the French Revolution begin?
A) 1776
B) 1789 ✓
C) 1799
D) 1804
ANSWER: B
```

---

### **4. Question Types Supported**

#### **Multiple Choice**
- 4 options (A, B, C, D)
- 1 correct answer
- Works for both math and general knowledge

**Math Example**:
```
Q: Solve for x: 3x - 7 = 14
A) x = 5
B) x = 7 ✓
C) x = 9
D) x = 11
```

**General Example**:
```
Q: What is photosynthesis?
A) Process of cell division
B) Process plants use to make food ✓
C) Process of water absorption
D) Process of reproduction
```

#### **True/False**
- Simple TRUE or FALSE answer
- Works for facts and statements

**Examples**:
```
Q: The Earth is flat.
ANSWER: FALSE

Q: Water boils at 100°C at sea level.
ANSWER: TRUE
```

#### **Fill-in-the-Blank**
- Missing word or phrase
- Tests recall and understanding

**Examples**:
```
Q: The capital of France is _____.
ANSWER: Paris

Q: Solve for x: 2x + 5 = 15, x = _____
ANSWER: 5
```

---

### **5. Fallback System (3-Tier)**

When AI fails or generates insufficient questions:

#### **Tier 1: Math Fallback**
If equations detected, generate questions using rule-based solvers:
```javascript
// Solves: 2x + 5 = 15 → x = 5
solveLinearAnyVar(equation)
solveLinearGeneral(equation)
solveLinearInequality(equation)
```

#### **Tier 2: General Knowledge Fallback**
Extract questions from content:
```javascript
generateGeneralKnowledgeQuestions(text, count, type)
```
- **Definition Questions**: "What is [key term]?"
- **True/False from Sentences**: Use actual sentences from text
- **Fill-in-Blank**: Remove key terms from sentences

#### **Tier 3: Arithmetic Fallback**
Generate simple math from numbers in text:
```javascript
// Finds: "15" and "7" in text
// Creates: "Compute 15 + 7"
// Answer: 22
```

---

### **6. Quality Control**

#### **Validation Checks**
```javascript
// Every question must pass:
- Has question text (min 10 chars)
- Has correct answer
- MCQ: Exactly 4 options
- True/False: Answer is TRUE or FALSE
- Fill-in-blank: Answer is not empty
```

#### **Smart Filtering**
```javascript
// For MATH content: Remove generic phrases
if (hasMathContent) {
  // Filter out: "According to the text...", "Based on the passage..."
  filterGenericQuestions(questions);
}

// For GENERAL content: Allow comprehension questions
// Don't filter, as "based on the text" is valid for knowledge tests
```

#### **Duplicate Removal**
```javascript
// Remove questions with identical text (case-insensitive)
const seen = new Set();
questions.filter(q => {
  const key = q.question.toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    return true;
  }
  return false;
});
```

---

## Example Workflows

### **Scenario 1: Math Textbook PDF**

**Input**: PDF with equations: `2x + 5 = 15`, `y - 3 = 9`, `$x^2 + 4x + 3 = 0$`

**Process**:
1. Extract text via Google Vision OCR
2. Detect equations → `hasMathContent = true`
3. AI generates with math-focused prompt
4. Parse and validate
5. Filter generic questions aggressively
6. Fallback: Use equation solvers if needed

**Output**:
```
✅ 5 math questions (equation solving)
✅ LaTeX preserved
✅ Correct numerical answers
✅ Relevant distractors
```

---

### **Scenario 2: History Word Document**

**Input**: Word doc about French Revolution

**Process**:
1. Extract text from .docx
2. Detect general content → `hasGeneralContent = true`
3. AI generates with comprehension-focused prompt
4. Parse and validate
5. Keep comprehension questions (don't filter)
6. Fallback: Extract definitions and key facts

**Output**:
```
✅ 5 knowledge questions
✅ Dates, names, concepts tested
✅ Comprehension-based
✅ Factually accurate from source
```

---

### **Scenario 3: Mixed Content (Science PDF)**

**Input**: PDF with both formulas and explanations

**Process**:
1. Extract text
2. Detect both math AND general content
3. AI generates mixed questions
4. Parse and validate
5. Partial filtering (math questions only)
6. Fallback: Mix of both types

**Output**:
```
✅ 2 math questions (formulas)
✅ 3 knowledge questions (concepts)
✅ Balanced coverage
✅ All validated
```

---

## Technical Implementation

### **Files Modified**

**`backend/quizGenerator.js`**:
- `createPrompt()` - Smart content detection and prompt generation
- `generateFallbackQuestions()` - 3-tier fallback system
- `generateGeneralKnowledgeQuestions()` - NEW: Knowledge extraction
- `filterGenericQuestions()` - Smart filtering based on content type

### **Key Functions**

```javascript
// Main entry point
generateQuiz(text, settings)

// Content analysis
extractEquations(text) → { latex, linear, inequalities, arithmetic }

// AI generation
createPrompt(text, count, type, difficulty, language)
hf.chatCompletion({ model, messages, parameters })

// Parsing
parseAIResponse(aiText, questionType)

// Quality control
filterGenericQuestions(questions) // Only for math content
validateQuestion(q)

// Fallback
generateMathFromEquations(equations, count, type)
generateGeneralKnowledgeQuestions(text, count, type) // NEW
```

---

## Configuration

**Environment Variables** (`.env`):
```bash
# AI Model Selection
HF_CHAT_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# Alternatives:
# HF_CHAT_MODEL=meta-llama/Llama-2-7b-chat-hf
# HF_CHAT_MODEL=codellama/CodeLlama-7b-Instruct-hf

# API Key
HUGGINGFACE_API_KEY=hf_your_key_here
```

**AI Parameters**:
```javascript
{
  max_tokens: 2000,      // Response length
  temperature: 0.3,      // Low = deterministic (good for math)
  top_p: 0.9            // Nucleus sampling threshold
}
```

---

## Benefits

### **For Math Content**:
✅ Accurate equation solving
✅ LaTeX preservation
✅ Numerical answer generation
✅ Relevant distractors
✅ No generic comprehension fluff

### **For General Knowledge**:
✅ Comprehension questions
✅ Factual recall
✅ Conceptual understanding
✅ Definition testing
✅ Valid "according to the text" questions

### **Overall**:
✅ Automatic content detection
✅ Smart prompt engineering
✅ Multi-tier fallback system
✅ Quality validation
✅ Duplicate removal
✅ Works with any document type

---

## Future Enhancements

### **Planned**:
- [ ] Support for diagrams/images in questions
- [ ] Multi-language quiz generation
- [ ] Question difficulty scoring
- [ ] Custom question templates
- [ ] Adaptive difficulty based on user performance

### **Advanced**:
- [ ] Quadratic equation solver
- [ ] Calculus problem generation
- [ ] Chemistry equation balancing
- [ ] Physics problem solving
- [ ] Code snippet questions (for programming content)

---

## Summary for Professor

**QuizCraft uses a hybrid approach**:

1. **AI-First**: Hugging Face Mistral-7B for intelligent question generation
2. **Content-Aware**: Automatically detects math vs. general knowledge content
3. **Smart Prompting**: Different prompt strategies for different content types
4. **Quality Control**: Multi-stage validation and filtering
5. **Reliability**: 3-tier fallback system ensures quiz generation never fails
6. **Flexibility**: Supports MCQ, True/False, Fill-in-Blank question types

**Key Innovation**: 
The system doesn't just generate generic questions - it adapts its strategy based on what type of content it detects, ensuring math problems for technical content and comprehension questions for general knowledge.
