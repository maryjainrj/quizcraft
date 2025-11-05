// src/services/quizER.js
import { graphqlQuery } from './graphql';

export const saveQuestionSetToDB = async (title, questions, fileNames, extractedTexts, settings, pdfUrl = null) => {
  console.log('=== Saving QuestionSet ===');
  console.log('Title:', title);
  console.log('Questions count:', questions.length);
  console.log('File names:', fileNames);
  console.log('Settings received:', settings);
  console.log('PDF URL:', pdfUrl);

  const mutation = `
    mutation CreateQuestionSet(
      $title: String!
      $questions: [QuestionInput!]!
      $fileAssets: [FileAssetInput!]
      $settings: QuestionSetSettingsInput
      $pdfUrl: String
    ) {
      createQuestionSet(
        title: $title
        questions: $questions
        fileAssets: $fileAssets
        settings: $settings
        pdfUrl: $pdfUrl
      ) {
        id
        title
        pdfUrl
        createdAt
      }
    }
  `;

  // Prepare file assets
  const fileAssets = fileNames.map((name, idx) => ({
    originalName: name,
    mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    size: 0,
    storagePath: `/uploads/${name}`,
    extractedText: extractedTexts[name] || ''
  }));

  // Extract unique question types from the actual questions
  const questionTypes = [...new Set(questions.map(q => {
    // Convert frontend types to backend types
    if (q.type === 'multiple-choice') return 'mcq';
    if (q.type === 'true-false') return 'true-false';
    if (q.type === 'fill-in-blank') return 'fill-in-blank';
    return 'mcq'; // default fallback
  }))];

  console.log('Detected question types:', questionTypes);

  // Prepare questions - Convert options array properly
  const questionInputs = questions.map(q => {
    const questionInput = {
      type: q.type, // 'multiple-choice', 'true-false', 'fill-in-blank'
      text: q.question,
      difficulty: settings?.difficulty || 'medium',
      correctText: q.correctAnswer || '',
      tags: []
    };

    // Only add options for multiple-choice questions, convert to proper format
    if (q.type === 'multiple-choice' && q.options && Array.isArray(q.options)) {
      questionInput.options = q.options.map((optText, idx) => ({
        option_index: idx,
        option_text: optText,
        is_correct: String.fromCharCode(65 + idx) === q.correctAnswer // Check if this option's letter matches correctAnswer
      }));
    } else {
      // For other question types, send empty array
      questionInput.options = [];
    }

    return questionInput;
  });

  // Build settings with proper defaults and type conversion
  const settingsInput = {
    types: questionTypes, // Use detected types from questions
    count: questions.length, // Use actual question count
    difficulty: settings?.difficulty || 'medium',
    category: settings?.category || ''
  };

  console.log('Settings input:', settingsInput);

  const variables = {
    title,
    questions: questionInputs,
    fileAssets: fileAssets,
    pdfUrl: pdfUrl,
    settings: settingsInput
  };

  console.log('GraphQL Variables:', JSON.stringify(variables, null, 2));

  try {
    const data = await graphqlQuery(mutation, variables);
    console.log(' Quiz saved successfully:', data);
    return data.createQuestionSet;
  } catch (error) {
    console.error(' Save failed:', error);
    console.error('Failed variables:', JSON.stringify(variables, null, 2));
    throw error;
  }
};

export const fetchMyQuestionSets = async () => {
  const query = `
    query MyQuestionSets {
      myQuestionSets {
        id
        title
        pdfUrl
        status
        createdAt
        sourceFileNames
        questionCount
        settings {
          count
          difficulty
          types
        }
      }
    }
  `;

  const data = await graphqlQuery(query);
  return data.myQuestionSets;
};

export const deleteQuestionSet = async (id) => {
  const mutation = `
    mutation DeleteQuestionSet($id: ID!) {
      deleteQuestionSet(id: $id)
    }
  `;

  const data = await graphqlQuery(mutation, { id });
  return data.deleteQuestionSet;
};

export const fetchQuestionSetById = async (id) => {
  const query = `
    query GetQuestionSet($id: ID!) {
      questionSet(id: $id) {
        id
        title
        pdfUrl
        status
        createdAt
        questions {
          question {
            id
            type
            text
            correctText
            options {
              option_index
              option_text
              is_correct
            }
          }
          question_order
        }
        sourceFiles {
          fileAsset {
            id
            originalName
            size
          }
        }
        settings {
          types
          count
          difficulty
        }
      }
    }
  `;

  const data = await graphqlQuery(query, { id });
  return data.questionSet;
};