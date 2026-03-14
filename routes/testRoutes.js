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

router.get('/:id', protect, authorize('admin', 'tutor'), testController.getTestById);

module.exports = router;