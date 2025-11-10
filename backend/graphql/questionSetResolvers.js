// backend/graphql/questionSetResolvers.js
const QuestionSet = require('../models/QuestionSet');
const QuestionNew = require('../models/QuestionNew');
const FileAsset = require('../models/FileAsset');
const { getUserFromReq } = require('./authResolvers');

module.exports = {
  // Queries
  myQuestionSets: async (_args, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');
    
    const questionSets = await QuestionSet.find({ createdBy: user._id })
      .populate('sourceFiles.fileAsset_id')
      .sort({ createdAt: -1 });
    
    return questionSets.map(qs => ({
      id: qs._id.toString(),
      title: qs.title,
      settings: qs.settings,
      pdfUrl: qs.pdfUrl,
      status: qs.status,
      createdAt: qs.createdAt.toISOString(),
      sourceFileNames: qs.sourceFiles.map(sf => sf.fileAsset_id?.originalName || 'Unknown').filter(Boolean),
      questionCount: qs.questions.length,
    }));
  },

  questionSet: async ({ id }, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');
    
    const qs = await QuestionSet.findById(id)
      .populate('createdBy')
      .populate('questions.question_id')
      .populate('sourceFiles.fileAsset_id');
      
    if (!qs) throw new Error('QuestionSet not found');
    if (qs.createdBy._id.toString() !== user._id.toString())
      throw new Error('Forbidden');
    
    return {
      id: qs._id.toString(),
      title: qs.title,
      settings: qs.settings,
      questions: qs.questions.map(q => ({
        question: q.question_id ? {
          id: q.question_id._id.toString(),
          type: q.question_id.type,
          text: q.question_id.text,
          category: q.question_id.category,
          difficulty: q.question_id.difficulty,
          explanation: q.question_id.explanation,
          source: q.question_id.source,
          correctText: q.question_id.correctText,
          options: q.question_id.options,
          tags: q.question_id.tags,
          createdAt: q.question_id.createdAt.toISOString(),
          updatedAt: q.question_id.updatedAt.toISOString(),
        } : null,
        question_order: q.question_order
      })).filter(q => q.question !== null),
      sourceFiles: qs.sourceFiles.map(sf => ({
        fileAsset: sf.fileAsset_id ? {
          id: sf.fileAsset_id._id.toString(),
          owner: {
            id: qs.createdBy._id.toString(),
            name: qs.createdBy.username || qs.createdBy.name || '',
            email: qs.createdBy.email,
          },
          originalName: sf.fileAsset_id.originalName,
          mimeType: sf.fileAsset_id.mimeType,
          size: sf.fileAsset_id.size,
          storagePath: sf.fileAsset_id.storagePath,
          extractedText: sf.fileAsset_id.extractedText,
          extractionMethod: sf.fileAsset_id.extractionMethod,
          extractionStats: sf.fileAsset_id.extractionStats,
          status: sf.fileAsset_id.status,
          createdAt: sf.fileAsset_id.createdAt.toISOString(),
          updatedAt: sf.fileAsset_id.updatedAt.toISOString(),
        } : null
      })).filter(sf => sf.fileAsset !== null),
      status: qs.status,
      version: qs.version,
      pdfUrl: qs.pdfUrl,
      createdBy: {
        id: qs.createdBy._id.toString(),
        name: qs.createdBy.username || qs.createdBy.name || '',
        email: qs.createdBy.email,
      },
      createdAt: qs.createdAt.toISOString(),
      updatedAt: qs.updatedAt.toISOString(),
    };
  },

  // Mutations
  createQuestionSet: async ({ title, questions, fileAssets, settings, pdfUrl }, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');

    console.log('=== createQuestionSet resolver ===');
    console.log('Questions received:', JSON.stringify(questions, null, 2));

    // 1. Create FileAssets first
    const createdFileAssets = [];
    if (fileAssets && fileAssets.length > 0) {
      for (const fa of fileAssets) {
        const fileAsset = await FileAsset.create({
          owner: user._id,
          originalName: fa.originalName,
          mimeType: fa.mimeType,
          size: fa.size,
          storagePath: fa.storagePath,
          extractedText: fa.extractedText || '',
          extractionMethod: 'client-side',
          status: 'completed'
        });
        createdFileAssets.push(fileAsset._id);
      }
    }

    // 2. Create Questions
    const createdQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      console.log(`Processing question ${i + 1}:`, {
        type: q.type,
        text: q.text?.substring(0, 50),
        optionsCount: q.options?.length,
        optionsStructure: q.options?.[0]
      });

      // Map frontend types to backend types
      const questionType = q.type === 'multiple-choice' ? 'mcq' 
        : q.type === 'true-false' ? 'true-false' 
        : q.type === 'fill-in-blank' ? 'fill-in-blank' 
        : q.type;

      // For MCQ, properly extract the options array
      let options = [];
      if (q.options && Array.isArray(q.options) && q.options.length > 0) {
        // The options are already in the correct format from the frontend
        options = q.options.map(opt => ({
          option_index: opt.option_index,
          option_text: opt.option_text, // Extract the string value
          is_correct: opt.is_correct
        }));
        
        console.log('Processed options:', options);
      }
      
      const questionData = {
        type: questionType,
        text: q.text,
        category: q.category || settings?.category || '',
        difficulty: q.difficulty || settings?.difficulty || 'medium',
        explanation: q.explanation || '',
        source: q.source || '',
        correctText: q.correctText || '',
        options: options, // Use the properly formatted options array
        tags: q.tags || []
      };

      console.log('Creating question with data:', JSON.stringify(questionData, null, 2));

      try {
        const question = await QuestionNew.create(questionData);
        createdQuestions.push({
          question_id: question._id,
          question_order: i + 1
        });
        console.log(`✅ Question ${i + 1} created successfully`);
      } catch (err) {
        console.error(`❌ Failed to create question ${i + 1}:`, err.message);
        throw new Error(`Failed to create question ${i + 1}: ${err.message}`);
      }
    }

    // 3. Create QuestionSet
    const questionSet = await QuestionSet.create({
      title,
      settings: {
        types: settings?.types || ['mcq'],
        count: settings?.count || questions.length,
        difficulty: settings?.difficulty || 'medium',
        category: settings?.category || ''
      },
      questions: createdQuestions,
      sourceFiles: createdFileAssets.map(id => ({ fileAsset_id: id })),
      originalQuestionsJSON: JSON.stringify(questions),
      status: 'active',
      version: 1,
      pdfUrl: pdfUrl || null,
      createdBy: user._id
    });

    // 4. Populate and return
    await questionSet.populate('createdBy');
    await questionSet.populate('questions.question_id');
    await questionSet.populate('sourceFiles.fileAsset_id');

    return {
      id: questionSet._id.toString(),
      title: questionSet.title,
      settings: questionSet.settings,
      questions: questionSet.questions.map(q => ({
        question: {
          id: q.question_id._id.toString(),
          type: q.question_id.type,
          text: q.question_id.text,
          category: q.question_id.category,
          difficulty: q.question_id.difficulty,
          explanation: q.question_id.explanation,
          source: q.question_id.source,
          correctText: q.question_id.correctText,
          options: q.question_id.options,
          tags: q.question_id.tags,
          createdAt: q.question_id.createdAt.toISOString(),
          updatedAt: q.question_id.updatedAt.toISOString(),
        },
        question_order: q.question_order
      })),
      sourceFiles: questionSet.sourceFiles.map(sf => ({
        fileAsset: {
          id: sf.fileAsset_id._id.toString(),
          owner: {
            id: questionSet.createdBy._id.toString(),
            name: questionSet.createdBy.username || questionSet.createdBy.name || '',
            email: questionSet.createdBy.email,
          },
          originalName: sf.fileAsset_id.originalName,
          mimeType: sf.fileAsset_id.mimeType,
          size: sf.fileAsset_id.size,
          storagePath: sf.fileAsset_id.storagePath,
          extractedText: sf.fileAsset_id.extractedText,
          extractionMethod: sf.fileAsset_id.extractionMethod,
          extractionStats: sf.fileAsset_id.extractionStats,
          status: sf.fileAsset_id.status,
          createdAt: sf.fileAsset_id.createdAt.toISOString(),
          updatedAt: sf.fileAsset_id.updatedAt.toISOString(),
        }
      })),
      status: questionSet.status,
      version: questionSet.version,
      pdfUrl: questionSet.pdfUrl,
      createdBy: {
        id: questionSet.createdBy._id.toString(),
        name: questionSet.createdBy.username || questionSet.createdBy.name || '',
        email: questionSet.createdBy.email,
      },
      createdAt: questionSet.createdAt.toISOString(),
      updatedAt: questionSet.updatedAt.toISOString(),
    };
  },

  updateQuestionSet: async ({ id, title, status }, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');
    
    const qs = await QuestionSet.findById(id);
    if (!qs) throw new Error('QuestionSet not found');
    if (qs.createdBy.toString() !== user._id.toString())
      throw new Error('Forbidden');
    
    if (title) qs.title = title;
    if (status) qs.status = status;
    
    await qs.save();
    await qs.populate('createdBy');
    await qs.populate('questions.question_id');
    await qs.populate('sourceFiles.fileAsset_id');
    
    return {
      id: qs._id.toString(),
      title: qs.title,
      settings: qs.settings,
      questions: qs.questions.map(q => ({
        question: {
          id: q.question_id._id.toString(),
          type: q.question_id.type,
          text: q.question_id.text,
          category: q.question_id.category,
          difficulty: q.question_id.difficulty,
          explanation: q.question_id.explanation,
          source: q.question_id.source,
          correctText: q.question_id.correctText,
          options: q.question_id.options,
          tags: q.question_id.tags,
          createdAt: q.question_id.createdAt.toISOString(),
          updatedAt: q.question_id.updatedAt.toISOString(),
        },
        question_order: q.question_order
      })),
      sourceFiles: qs.sourceFiles.map(sf => ({
        fileAsset: {
          id: sf.fileAsset_id._id.toString(),
          owner: {
            id: qs.createdBy._id.toString(),
            name: qs.createdBy.username || qs.createdBy.name || '',
            email: qs.createdBy.email,
          },
          originalName: sf.fileAsset_id.originalName,
          mimeType: sf.fileAsset_id.mimeType,
          size: sf.fileAsset_id.size,
          storagePath: sf.fileAsset_id.storagePath,
          extractedText: sf.fileAsset_id.extractedText,
          extractionMethod: sf.fileAsset_id.extractionMethod,
          extractionStats: sf.fileAsset_id.extractionStats,
          status: sf.fileAsset_id.status,
          createdAt: sf.fileAsset_id.createdAt.toISOString(),
          updatedAt: sf.fileAsset_id.updatedAt.toISOString(),
        }
      })),
      status: qs.status,
      version: qs.version,
      pdfUrl: qs.pdfUrl,
      createdBy: {
        id: qs.createdBy._id.toString(),
        name: qs.createdBy.username || qs.createdBy.name || '',
        email: qs.createdBy.email,
      },
      createdAt: qs.createdAt.toISOString(),
      updatedAt: qs.updatedAt.toISOString(),
    };
  },

  deleteQuestionSet: async ({ id }, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');
    
    const qs = await QuestionSet.findById(id);
    if (!qs) throw new Error('QuestionSet not found');
    if (qs.createdBy.toString() !== user._id.toString())
      throw new Error('Forbidden');
    
    await QuestionSet.findByIdAndDelete(id);
    return true;
  },

  // FileAsset operations
  createFileAsset: async ({ originalName, mimeType, size, storagePath, extractedText }, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');

    const fileAsset = await FileAsset.create({
      owner: user._id,
      originalName,
      mimeType,
      size,
      storagePath,
      extractedText: extractedText || '',
      status: 'completed'
    });

    await fileAsset.populate('owner');

    return {
      id: fileAsset._id.toString(),
      owner: {
        id: fileAsset.owner._id.toString(),
        name: fileAsset.owner.username || fileAsset.owner.name || '',
        email: fileAsset.owner.email,
      },
      originalName: fileAsset.originalName,
      mimeType: fileAsset.mimeType,
      size: fileAsset.size,
      storagePath: fileAsset.storagePath,
      extractedText: fileAsset.extractedText,
      extractionMethod: fileAsset.extractionMethod,
      extractionStats: fileAsset.extractionStats,
      status: fileAsset.status,
      createdAt: fileAsset.createdAt.toISOString(),
      updatedAt: fileAsset.updatedAt.toISOString(),
    };
  },

  myFileAssets: async (_args, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');
    
    const fileAssets = await FileAsset.find({ owner: user._id })
      .populate('owner')
      .sort({ createdAt: -1 });
    
    return fileAssets.map(fa => ({
      id: fa._id.toString(),
      owner: {
        id: fa.owner._id.toString(),
        name: fa.owner.username || fa.owner.name || '',
        email: fa.owner.email,
      },
      originalName: fa.originalName,
      mimeType: fa.mimeType,
      size: fa.size,
      storagePath: fa.storagePath,
      extractedText: fa.extractedText,
      extractionMethod: fa.extractionMethod,
      extractionStats: fa.extractionStats,
      status: fa.status,
      createdAt: fa.createdAt.toISOString(),
      updatedAt: fa.updatedAt.toISOString(),
    }));
  },

  fileAsset: async ({ id }, context) => {
    const user = await getUserFromReq(context);
    if (!user) throw new Error('Unauthenticated');
    
    const fa = await FileAsset.findById(id).populate('owner');
    if (!fa) throw new Error('FileAsset not found');
    if (fa.owner._id.toString() !== user._id.toString())
      throw new Error('Forbidden');
    
    return {
      id: fa._id.toString(),
      owner: {
        id: fa.owner._id.toString(),
        name: fa.owner.username || fa.owner.name || '',
        email: fa.owner.email,
      },
      originalName: fa.originalName,
      mimeType: fa.mimeType,
      size: fa.size,
      storagePath: fa.storagePath,
      extractedText: fa.extractedText,
      extractionMethod: fa.extractionMethod,
      extractionStats: fa.extractionStats,
      status: fa.status,
      createdAt: fa.createdAt.toISOString(),
      updatedAt: fa.updatedAt.toISOString(),
    };
  },
};