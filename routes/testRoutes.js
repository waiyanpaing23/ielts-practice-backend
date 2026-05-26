const express = require('express');
const router = express.Router();
const testController = require('./../controllers/testController');
const { protect, authorize } = require('./../middleware/auth');

router.use(protect);

router.post(
    '/',
    testController.createTest
)

router.get(
    '/',
    protect,
    testController.getAllTests
);

router.get('/mini-practice', testController.getMiniPractice);

router.get('/recommend-adaptive', testController.getAdaptiveFullTest);

router.get('/:id', testController.getTestById);

module.exports = router;