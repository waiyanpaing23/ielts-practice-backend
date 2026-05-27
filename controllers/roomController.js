const Test = require('../models/Test');
const TestAttempt = require('../models/TestAttempt');
const Room = require('./../models/Room');

const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const calculateBandScore = (correctCount, totalQuestions) => {
    if (totalQuestions === 0) return 0;
    
    const scaledScore = Math.round((correctCount / totalQuestions) * 40);
    
    if (scaledScore >= 39) return 9.0;
    if (scaledScore >= 37) return 8.5;
    if (scaledScore >= 35) return 8.0;
    if (scaledScore >= 33) return 7.5;
    if (scaledScore >= 30) return 7.0;
    if (scaledScore >= 27) return 6.5;
    if (scaledScore >= 23) return 6.0;
    if (scaledScore >= 19) return 5.5;
    if (scaledScore >= 15) return 5.0;
    if (scaledScore >= 13) return 4.5;
    if (scaledScore >= 10) return 4.0;
    if (scaledScore >= 8)  return 3.5;
    if (scaledScore >= 6)  return 3.0;
    if (scaledScore >= 4)  return 2.5;
    
    return 0;
};

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
            roomName = `${test.title} (${today})`;
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
            .populate({
                path: 'test',
                populate: {
                    path: 'reading_sets'
                }
            })
            .populate('participants.user', 'fullName email');

        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found.' });
        }

        // 1. Safely extract IDs (if they exist)
        const userId = req.user ? req.user._id.toString() : null;
        const guestId = req.headers['x-guest-id']; 

        const activeIdentity = userId || guestId;
        if (!activeIdentity) {
            return res.status(401).json({ message: "No identity found" });
        }

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

        if (room.status === 'waiting' && room.test && room.test.readingSets) {
            room.test.readingSets.forEach(set => {
                set.questions = undefined;
                set.passage = undefined;
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

        const activeIdentity = userId || guestId;
        if (!activeIdentity) {
            return res.status(401).json({ message: "No identity found" });
        }

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

        const uniqueStudents = new Set();
        let activeRoomsCount = 0;

        rooms.forEach(room => {
            if (room.status === 'waiting' || room.status === 'in_progress') {
                activeRoomsCount++;
            }

            room.participants.forEach(p => {
                if (p.user) {
                    uniqueStudents.add(p.user.toString());
                } else if (p.guestId) {
                    uniqueStudents.add(p.guestId);
                }
            });
        });

        res.status(200).json({
            success: true,
            data: rooms,
            stats: {
                totalUniqueStudents: uniqueStudents.size,
                activeRoomsCount: activeRoomsCount,
                totalSessions: rooms.length
            }
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

        let query = {};
        if (userId) {
            query = { 'participants.user': userId };
        } else {
            query = { 'participants.guestId': guestId };
        }

        const rooms = await Room.find(query)
            .populate('test', 'title')
            .sort({ createdAt: -1 });

        const roomsWithAttempts = await Promise.all(rooms.map(async (room) => {
            // Convert to a plain JavaScript object so we can add new fields to it
            let roomObj = room.toObject();

            if (roomObj.status === 'completed') {
                // Build the search query for the specific student's attempt
                const attemptQuery = { room_id: room._id };
                if (userId) {
                    attemptQuery.user = userId;
                } else {
                    attemptQuery.guestId = guestId;
                }

                // Search the database for their test paper
                const attempt = await TestAttempt.findOne(attemptQuery);

                if (attempt) {
                    // If found, attach the ID so React can route them properly!
                    roomObj.attemptId = attempt._id;
                }
            }

            return roomObj;
        }));

        res.status(200).json({
            success: true,
            data: roomsWithAttempts
        });

    } catch (error) {
        console.error('Get joined rooms error:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching joined rooms.' });
    }
};


exports.startAssessment = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found.' });
        }

        if (room.tutor_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        room.status = 'in_progress';
        room.startedAt = new Date(); // Mark exactly when the timer started!
        
        await room.save();

        res.status(200).json({
            success: true,
            message: 'Assessment started successfully.',
            data: room
        });

    } catch (error) {
        console.error('Start assessment error:', error);
        res.status(500).json({ success: false, message: 'Server Error.' });
    }
};


exports.submitAssessment = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { answers, studentId } = req.body; // answers is an object: { "questionId": "True", "questionId2": "A" }

    const room = await Room.findById(roomId).populate({
      path: 'test',
      populate: {
        path: 'reading_sets',
        populate: {
          path: 'questions'
        }
      }
    });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const participantIndex = room.participants.findIndex(
      p => (p.user && p.user.toString() === studentId) || (p.guestId === studentId)
    );

    if (participantIndex === -1) {
      return res.status(404).json({ success: false, message: 'Student not found in room' });
    }

    let totalQuestions = 0;
    let correctAnswers = 0;
    const analysis = [];
    const readingSets = room.test?.reading_sets || [];

    readingSets.forEach(set => {
      const questions = set?.questions || [];

      questions.forEach(question => {
        totalQuestions++;
        const studentAnswer = answers[question._id.toString()] || '';
        const correctAnswer = question.correct_answer || '';
        
        const isCorrect = studentAnswer && studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        
        if (isCorrect) {
          correctAnswers++;
        }

        analysis.push({
          id: question._id,
          content: question.content,
          studentAnswer: studentAnswer || 'No Answer',
          correctAnswer: correctAnswer,
          isCorrect: isCorrect,
          questionType: question.question_type || 'General',
          explanation: question.explanation || 'No explanation provided for this question.'
        });
      });
    });

    if (totalQuestions === 0) totalQuestions = 1;
    const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100);
    const estimatedBand = calculateBandScore(correctAnswers, totalQuestions);

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is missing from the request.' });
    }

    const isGuest = studentId.startsWith('guest_');
    
    const newAttempt = new TestAttempt({
      test: room.test._id,
      user: isGuest ? null : studentId,
      guestId: isGuest ? studentId : null,
      room_id: roomId,
      totalQuestions: totalQuestions,
      score: scorePercentage,
      rawScore: correctAnswers,       
      bandScore: estimatedBand,
      userAnswers: answers,
      analysis: analysis
    });
    
    await newAttempt.save();

    room.participants[participantIndex].hasFinished = true;
    room.participants[participantIndex].score = scorePercentage;
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('student-submitted', { studentId, finalScore: scorePercentage });
    }

    res.status(200).json({
      success: true,
      message: 'Assessment submitted successfully',
      data: { 
        attemptId: newAttempt._id,
      }
    });

  } catch (error) {
    console.error('Submit assessment error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


exports.getRoomLeaderboard = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)
        .populate('participants.user', 'fullName')
        .populate('test', 'title');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const rawAttempts = await TestAttempt.find({ room_id: roomId });

    // Remove duplicate attempts logic
    const uniqueAttemptsMap = new Map();

    rawAttempts.forEach(attempt => {
      const learnerKey = attempt.user ? attempt.user.toString() : attempt.guestId;
      if (!uniqueAttemptsMap.has(learnerKey)) {
        uniqueAttemptsMap.set(learnerKey, attempt);
      } else {
        const existingAttempt = uniqueAttemptsMap.get(learnerKey);
        if ((attempt.score || 0) > (existingAttempt.score || 0)) {
          uniqueAttemptsMap.set(learnerKey, attempt);
        }
      }
    });

    const attempts = Array.from(uniqueAttemptsMap.values());
    // Remove duplicate attempts logic end

    let leaderboard = attempts.map(attempt => {
      let participantName = 'Unknown Learner';

      const participant = room.participants.find(p =>
        (p.user && attempt.user && p.user._id.toString() === attempt.user.toString()) ||
        (p.guestId && attempt.guestId && p.guestId === attempt.guestId)
      );

      if (participant) {
        participantName = participant.user ? participant.user.fullName : participant.guestName;
      }

      return {
        attemptId: attempt._id,
        name: participantName || 'Guest Learner',
        score: attempt.score,
        bandScore: attempt.bandScore,
        correctAnswers: attempt.rawScore
      };
    });

    leaderboard.sort((a, b) => b.score - a.score);

    res.status(200).json({ 
      success: true, 
      data: {
        roomName: room.name,
        testTitle: room.test ? room.test.title : 'IELTS Practice Assessment',
        leaderboard: leaderboard
      } 
    });

  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


exports.endRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Room is already completed' });
    }

    room.status = 'completed';
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('room-ended', { roomId });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Assessment ended successfully',
      data: room
    });

  } catch (error) {
    console.error('End room error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};