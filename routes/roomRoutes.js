const express = require('express')
const router = express.Router();
const roomController = require('./../controllers/roomController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

router.post(
    '/', 
    protect,
    authorize('tutor', 'admin'), 
    roomController.createRoom
);

router.get('/', protect, authorize('tutor', 'admin'), roomController.getTutorRooms);

router.post(
    '/join', 
    optionalAuth, 
    roomController.joinRoom
);

router.get(
    '/joined', 
    optionalAuth,
    roomController.getJoinedRooms
);

router.post('/:id/leave', optionalAuth, roomController.leaveRoom);

router.get(
    '/:id',
    optionalAuth,
    roomController.getRoomById
);

router.delete('/:id', protect, authorize('tutor', 'admin'), roomController.deleteRoom);

module.exports = router;
