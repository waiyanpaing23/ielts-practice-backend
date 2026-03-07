const Test = require('../models/Test');
const Room = require('./../models/Room');

const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

exports.createRoom = async (req, res) => {
    try {
        const { name, testId, customTimeLimit } = req.body;

        if (!testId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide a testId to host a room' 
            });
        }

        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found' });
        }

        let roomName = name;
        if (!roomName) {
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            roomName = `Live: ${test.title} (${today})`;
        }

        const timeLimit = customTimeLimit || test.timeLimit;

        let roomCode = generateRoomCode();
        let isUnique = false;

        while (!isUnique) {
            const existingRoom = await Room.findOne({ code: roomCode });
            if (!existingRoom) {
                isUnique = true;
            } else {
                roomCode = generateRoomCode();
            }
        }

        const room = await Room.create({
            name: roomName,
            code: roomCode,
            tutor_id: req.user.id,
            test: testId,
            customTimeLimit: timeLimit
        });

        res.status(201).json({
            success: true,
            message: 'Room created! The lobby is now open.',
            data: room
        });

    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}