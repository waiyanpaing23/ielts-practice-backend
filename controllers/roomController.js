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
            roomName = `Room: ${test.title} (${today})`;
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


exports.getRoomById = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id)
            .populate('test', 'title timeLimit')
            .populate('participants.user', 'fullName email');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found.'
            });
        }

        const isTutor = room.tutor_id.toString() === req.user._id.toString();
        const isJoinedLearner = room.participants.some(p => p.user._id.toString() === req.user._id.toString());

        if (!isTutor && !isJoinedLearner) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this room'
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (error) {
        console.error('Get room error:', error);

        if (error.name === 'CastError') {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }
        
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}


exports.deleteRoom = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);

        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }

        if (room.tutor_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to close this room' });
        }

        await room.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Room successfully closed'
        });

    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


exports.joinRoom = async (req, res) => {
    try {
        const { code } = req.body;

        // 1. Basic Validation
        if (!code || code.length !== 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide a valid 6-character room code.' 
            });
        }

        // 2. Find the room by its unique code
        const room = await Room.findOne({ code: code.toUpperCase() });

        if (!room) {
            return res.status(404).json({ 
                success: false, 
                message: 'Invalid room code. Please check with your tutor and try again.' 
            });
        }

        // 3. Check if the room is still open
        if (room.status === 'completed') {
            return res.status(400).json({ 
                success: false, 
                message: 'This assessment room has already been closed.' 
            });
        }

        // 4. Check if the student is already in the room
        // 👇 UPDATED: Using `p.user` to match your schema
        const alreadyJoined = room.participants.find(
            (p) => p.user.toString() === req.user._id.toString()
        );

        if (!alreadyJoined) {
            // 👇 UPDATED: Pushing exactly what your schema expects
            room.participants.push({
                user: req.user._id
                // joinedAt and hasFinished automatically get their default values (Date.now and false)!
            });
            await room.save();
        }

        // 5. Success! Send the ID back so React can redirect them
        res.status(200).json({
            success: true,
            message: 'Successfully joined the room.',
            data: {
                roomId: room._id
            }
        });

    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({ success: false, message: 'Server Error processing join request.' });
    }
};


exports.getTutorRooms = async (req, res) => {
    try {
        const rooms = await Room.find({ tutor_id: req.user._id })
            .populate('test', 'title')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: rooms.length,
            data: rooms
        });
    } catch (error) {
        console.error('Fetch tutor rooms error:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching rooms.' });
    }
};