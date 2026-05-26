const jwt = require('jsonwebtoken');
const TestAttempt = require('../models/TestAttempt');
const ReadingSet = require('../models/ReadingSet');
const Test = require('../models/Test');

// Helper to calculate band score
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

exports.getAttemptResult = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await TestAttempt.findById(attemptId).populate({
      path: 'test',
      populate: {
        path: 'reading_sets',
        populate: {
          path: 'questions'
        }
      }
    })
    .populate('room_id');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Test attempt not found' });
    }

    let analysis = [];
    let totalQuestions = attempt.totalQuestions || 0; 

    // 👇 SCENARIO A: Mini Practice (The data is already saved in the database!)
    if (attempt.analysis && attempt.analysis.length > 0) {
        analysis = attempt.analysis;
    } 
    // 👇 SCENARIO B: Legacy/Room-based Test (Rebuild analysis dynamically from the Test document)
    else if (attempt.test && attempt.test.reading_sets) {
        const answers = attempt.userAnswers || {};
        const readingSets = attempt.test.reading_sets;
        totalQuestions = 0; // Reset and count manually for legacy tests

        readingSets.forEach(set => {
            const questions = set?.questions || [];

            questions.forEach(question => {
                totalQuestions++;
                const studentAnswer = answers[question._id.toString()] || '';
                const correctAnswer = question.correct_answer || '';
                
                const isCorrect = studentAnswer && studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

                analysis.push({
                    question_id: question._id, // Updated to match our new frontend standard
                    content: question.content,
                    studentAnswer: studentAnswer || 'No Answer',
                    correctAnswer: correctAnswer,
                    isCorrect: isCorrect,
                    questionType: question.question_type,
                    explanation: question.explanation || 'No explanation provided for this question.'
                });
            });
        });
    }

    // Send data matching the exact property names our React component expects
    res.status(200).json({
      success: true,
      data: {
        score: attempt.score, // The percentage
        bandScore: attempt.bandScore, // The estimated IELTS band
        rawScore: attempt.rawScore, // e.g., 4 correct
        totalQuestions: totalQuestions, // e.g., 13 total
        analysis: analysis,
        testTitle: attempt.test?.title || 'IELTS Reading Mini Practice', // Smart fallback title
        roomName: attempt.room_id?.name || null,
        createdAt: attempt.createdAt
      }
    });

  } catch (error) {
    console.error("Fetch attempt error:", error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


exports.getMyHistory = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const guestId = req.headers['x-guest-id'];

    if (!userId && !guestId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const query = userId ? { user: userId } : { guestId: guestId };

    const attempts = await TestAttempt.find(query)
      .populate('test', 'title')
      .populate('room_id', 'name')
      .sort({ createdAt: -1 });

    const historyData = attempts.map(attempt => ({
      attemptId: attempt._id,
      percentage: attempt.score || 0,       // The 0-100 percentage
      bandScore: attempt.bandScore || 0,    // The IELTS Band (e.g., 7.5)
      testTitle: attempt.test 
        ? attempt.test.title 
        : (attempt.rawScore && attempt.analysis && attempt.analysis.length < 20) 
            ? 'Mini Practice Drill' 
            : 'IELTS Reading Practice',
      dateCompleted: attempt.createdAt,
      roomName: attempt.room_id ? attempt.room_id.name : 'Self Practice'
    }));

    res.status(200).json({
      success: true,
      data: historyData
    });

  } catch (error) {
    console.error("Fetch history error:", error);
    res.status(500).json({ success: false, message: 'Server Error fetching history' });
  }
};


exports.submitPractice = async (req, res) => {

    try {
        // 1. Identify the user
        let userId = req.user ? req.user._id : null;
        let guestId = req.headers['x-guest-id'];

        if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                // 🐛 BUGFIX: Sometimes localStorage saves tokens with extra quote marks like "eyJ...". This strips them!
                const token = req.headers.authorization.split(' ')[1].replace(/"/g, ''); 
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                userId = decoded.id || decoded._id; 
            } catch (err) {
                console.error("❌ 5. JWT Verification Failed! Reason:", err.message);
            }
        }

        // Clean up string "null" just in case localStorage passed it as a string
        if (guestId === 'null' || guestId === 'undefined') guestId = null;

        if (!userId && !guestId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        // 2. Extract data from frontend payload
        const { readingSetId, answers, timeSpent } = req.body;

        // 3. Fetch the real passage with the correct answers (NOT the safeJSON version)
        const passage = await ReadingSet.findById(readingSetId);
        if (!passage) {
            return res.status(404).json({ success: false, message: 'Passage not found' });
        }

        // 4. The Grading Engine
        let correctCount = 0;
        const totalQuestions = passage.questions.length;
        const analysis = [];

        passage.questions.forEach((question) => {
            const studentAnswer = answers[question._id] || 'Not answered';
            const correctAnswer = question.correct_answer;
            
            let isCorrect = false;

            // IELTS Grading Logic (Case-insensitive, trim whitespace)
            if (studentAnswer !== 'Not answered') {
                const cleanStudent = String(studentAnswer).trim().toLowerCase();
                const cleanCorrect = String(correctAnswer).trim().toLowerCase();
                
                if (cleanStudent === cleanCorrect) {
                    isCorrect = true;
                }
            }

            if (isCorrect) correctCount++;

            // Push the detailed review data so the Result page can render it
            analysis.push({
                question_id: question._id,
                content: question.content,
                studentAnswer: studentAnswer,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect,
                questionType: question.question_type || 'General',
                explanation: question.explanation || 'No explanation provided.'
            });
        });

        // Calculate percentage score
        const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

        const scaledScore = Math.round((correctCount / totalQuestions) * 40);
        const estimatedBand = calculateBandScore(correctCount, totalQuestions);

        // 5. Save the Attempt to the Database
        const newAttempt = await TestAttempt.create({
            user: userId,
            guestId: guestId,
            room_id: null, 
            test: null, 
            totalQuestions: totalQuestions,
            score: scorePercentage,
            rawScore: correctCount,
            bandScore: estimatedBand,
            timeSpent: timeSpent,
            userAnswers: answers,
            analysis: analysis
        });

        // 6. Send the ID back so React can route to the Result page
        res.status(200).json({
            success: true,
            data: {
                attemptId: newAttempt._id
            }
        });

    } catch (error) {
        console.error("Practice submission error:", error);
        res.status(500).json({ success: false, message: 'Server error during submission' });
    }
};


exports.submitFullPractice = async (req, res) => {
    try {
        // 1. Identify the user (Same robust Auth logic as before)
        let userId = req.user ? req.user._id : null;
        let guestId = req.headers['x-guest-id'];

        if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const token = req.headers.authorization.split(' ')[1].replace(/"/g, ''); 
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id || decoded._id; 
            } catch (err) {
                console.error("JWT Verification Failed:", err.message);
            }
        }

        if (guestId === 'null' || guestId === 'undefined') guestId = null;

        if (!userId && !guestId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        // 2. Extract data from frontend payload
        const { testId, answers, timeSpent } = req.body;

        // 3. Fetch the Full Test AND populate all nested questions
        const test = await Test.findById(testId).populate({
            path: 'reading_sets',
            populate: {
                path: 'questions'
            }
        });

        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found' });
        }

        // 4. The Grand Grading Engine
        let correctCount = 0;
        let totalQuestions = 0;
        const analysis = [];

        // Loop through all 3 passages
        test.reading_sets.forEach((passage) => {
            const questions = passage.questions || [];
            
            // Loop through all questions in this specific passage
            questions.forEach((question) => {
                totalQuestions++;
                const studentAnswer = answers[question._id] || 'Not answered';
                const correctAnswer = question.correct_answer;
                
                let isCorrect = false;

                // IELTS Grading Logic (Case-insensitive, trim whitespace)
                if (studentAnswer !== 'Not answered') {
                    const cleanStudent = String(studentAnswer).trim().toLowerCase();
                    const cleanCorrect = String(correctAnswer).trim().toLowerCase();
                    if (cleanStudent === cleanCorrect) isCorrect = true;
                }

                if (isCorrect) correctCount++;

                // Push to the massive analysis array
                analysis.push({
                    question_id: question._id,
                    content: question.content,
                    studentAnswer: studentAnswer,
                    correctAnswer: correctAnswer,
                    isCorrect: isCorrect,
                    questionType: question.question_type || 'General',
                    explanation: question.explanation || 'No explanation provided.'
                });
            });
        });

        // 5. Calculate Final Scores
        // Failsafe just in case a test was uploaded with missing questions
        if (totalQuestions === 0) totalQuestions = 1; 

        const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

        // IELTS Band Score Logic (Scaled to 40 just in case the test has 39 or 41 questions)
        const scaledScore = Math.round((correctCount / totalQuestions) * 40);
        const estimatedBand = calculateBandScore(correctCount, totalQuestions);

        // 6. Save the Massive Attempt to the Database
        const newAttempt = await TestAttempt.create({
            user: userId,
            guestId: guestId,
            room_id: null, // Null because this is Self-Practice!
            test: testId,  // Link to the full test!
            totalQuestions: totalQuestions,
            score: scorePercentage,
            rawScore: correctCount,
            bandScore: estimatedBand,
            timeSpent: timeSpent,
            userAnswers: answers,
            analysis: analysis
        });

        // 7. Send the ID back so React can route to the Result page
        res.status(200).json({
            success: true,
            data: {
                attemptId: newAttempt._id
            }
        });

    } catch (error) {
        console.error("Full Practice submission error:", error);
        res.status(500).json({ success: false, message: 'Server error during full submission' });
    }
};


exports.getUserLifetimeInsights = async (req, res) => {
  try {
    
    if (!req.user || !req.user._id) {
      return res.status(200).json({ success: true, data: [] });
    }

    const userId = req.user._id;

    const insights = await TestAttempt.aggregate([
      { $match: { user: userId } },
      { $unwind: "$analysis" },
      { 
        $group: {
          _id: "$analysis.questionType",
          totalAttempted: { $sum: 1 },
          totalCorrect: { 
            $sum: { $cond: [{ $eq: ["$analysis.isCorrect", true] }, 1, 0] } 
          }
        }
      },
      
      {
        $project: {
          questionType: "$_id",
          _id: 0,
          totalAttempted: 1,
          totalCorrect: 1,
          winRate: {
            $round: [
              { $multiply: [{ $divide: ["$totalCorrect", "$totalAttempted"] }, 100] },
              0 // Round to 0 decimal places
            ]
          }
        }
      },
      { $sort: { winRate: -1 } }
    ]);

    res.status(200).json({ success: true, data: insights });

  } catch (error) {
    console.error("Insight Aggregation Error:", error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};