const express = require('express');
const router = express.Router();
const readingSetController = require('./../controllers/readingSetController');
const { protect, authorize } = require('./../middleware/auth');

router.use(protect);

router.post(
    '/',
    readingSetController.createReadingSet
)

router.get(
    '/',
    readingSetController.getReadingSets
)

router.get(
    '/:id',
    // authorize('admin'),
    readingSetController.getReadingSetById
)

module.exports = router;