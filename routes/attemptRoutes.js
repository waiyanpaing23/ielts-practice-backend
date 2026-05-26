const express = require('express')
const router = express.Router();
const attemptController = require('./../controllers/attemptController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

router.get('/history', protect, attemptController.getMyHistory);

router.post('/practice-submit', attemptController.submitPractice);

router.post('/full-practice-submit', attemptController.submitFullPractice);

router.get('/lifetime-insights', protect, attemptController.getUserLifetimeInsights);

router.get('/:attemptId', attemptController.getAttemptResult);

module.exports = router;
