const express = require('express')
const router = express.Router();
const roomController = require('./../controllers/roomController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post(
    '/', 
    // authorize('tutor', 'admin'), 
    roomController.createRoom
);

router.get('/', protect, authorize('tutor', 'admin'), roomController.getTutorRooms);

router.post(
    '/join', 
    protect, 
    authorize('learner', 'admin', 'tutor'),
    roomController.joinRoom
);

router.get(
    '/:id',
    protect,
    // authorize('tutor', 'admin'),
    roomController.getRoomById
);

router.delete('/:id', protect, authorize('tutor', 'admin'), roomController.deleteRoom);

module.exports = router;
