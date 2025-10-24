const express = require('express');
const router = express.Router();
const { uploadFile } = require('../controllers/questionController');

router.post('/upload', uploadFile);

module.exports = router;
