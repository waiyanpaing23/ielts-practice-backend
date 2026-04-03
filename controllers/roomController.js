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
            .populate('test')
            .populate('participants.user', 'fullName email');

        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found.' });
        }

        // 1. Safely extract IDs (if they exist)
        const userId = req.user ? req.user._id.toString() : null;
        // We will look for the guestId in the request headers
        const guestId = req.headers['x-guest-id']; 

        let isTutor = false;
        let isJoinedLearner = false;

        if (userId) {
            // Check if they are the tutor
            isTutor = room.tutor_id.toString() === userId;
            isJoinedLearner = room.participants.some(p => p.user && p.user._id.toString() === userId);
        } else if (guestId) {
            isJoinedLearner = room.participants.some(p => p.guestId === guestId);
        }

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
        const { code, guestName, guestId } = req.body;

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

        const isRegisteredUser = req.user && req.user._id;

        if (!isRegisteredUser && (!guestName || !guestId)) {
            return res.status(400).json({ success: false, message: 'Guest name and ID are required.' });
        }

        const alreadyJoined = room.participants.find(p => {
            if (isRegisteredUser && p.user) {
                return p.user.toString() === req.user._id.toString();
            }
            if (!isRegisteredUser && p.guestId) {
                return p.guestId === guestId;
            }
            return false;
        });

        if (!alreadyJoined) {
            const newParticipant = {};

            if (isRegisteredUser) {
                newParticipant.user = req.user._id;
            } else {
                newParticipant.guestName = guestName;
                newParticipant.guestId = guestId;
            }

            room.participants.push(newParticipant);
            
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


exports.leaveRoom = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found.' });
        }

        const userId = req.user ? req.user._id.toString() : null;
        const guestId = req.headers['x-guest-id']; 

        // Filter the participants array to remove the specific user/guest
        const originalLength = room.participants.length;
        
        room.participants = room.participants.filter(p => {
            if (userId && p.user) {
                return p.user.toString() !== userId;
            }
            if (guestId && p.guestId) {
                return p.guestId !== guestId;
            }
            return true;
        });

        // Only save if someone was actually removed
        if (room.participants.length < originalLength) {
            await room.save();
            
            const io = req.app.get('io');
            if (io) {
                io.to(req.params.id).emit('student_left');
            }
        }

        res.status(200).json({
            success: true,
            message: 'Successfully left the room.'
        });

    } catch (error) {
        console.error('Leave room error:', error);
        res.status(500).json({ success: false, message: 'Server Error processing leave request.' });
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


exports.getJoinedRooms = async (req, res) => {
    try {
        const userId = req.user ? req.user._id : null;
        const guestId = req.headers['x-guest-id'];

        if (!userId && !guestId) {
            return res.status(200).json({ success: true, data: [] });
        }

        // 2. Build the Mongoose search query
        let query = {};
        if (userId) {
            query = { 'participants.user': userId };
        } else {
            query = { 'participants.guestId': guestId };
        }

        // 3. Fetch the rooms and populate the Test details for the frontend cards
        const rooms = await Room.find(query)
            .populate('test', 'title') // Grab the test title so the UI looks nice
            .sort({ createdAt: -1 });  // Sort by newest first

        res.status(200).json({
            success: true,
            data: rooms
        });

    } catch (error) {
        console.error('Get joined rooms error:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching joined rooms.' });
    }
};