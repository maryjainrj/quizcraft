const express = require('express');
const router = express.Router();
const { uploadFile, getMyQuestionSets } = require('../controllers/questionController');

router.post('/upload', uploadFile);
router.get('/mine', getMyQuestionSets);

module.exports = router;
