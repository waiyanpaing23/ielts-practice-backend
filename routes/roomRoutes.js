const express = require('express')
const router = express.Router();
const roomController = require('./../controllers/roomController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post(
    '/', 
    authorize('tutor', 'admin'), 
    roomController.createRoom
);

module.exports = router;
