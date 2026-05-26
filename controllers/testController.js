const Test = require('../models/Test');
const ReadingSet = require('../models/ReadingSet');
const TestAttempt = require('../models/TestAttempt');

exports.createTest = async (req, res) => {
    try {
        const { title, timeLimit, reading_sets, isPublic } = req.body;

        if (!title || !reading_sets) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a title and reading sets.'
            });
        }

        if (!Array.isArray(reading_sets) || reading_sets.length !== 3) {
            return res.status(400).json({
                success: false,
                message: 'An IELTS Reading Test must contain exactly 3 passages.'
            });
        }

        const existingPassages = await ReadingSet.countDocuments({
            _id: { $in: reading_sets }
        });

        if (existingPassages !== 3) {
            return res.status(404).json({
                success: false,
                message: 'One or more of the selected Reading Sets could not be found.'
            });
        }

        const test = await Test.create({
            title,
            timeLimit: timeLimit || 60,
            reading_sets,
            isPublic: isPublic || false,
            creator_id: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Test compiled successfully.',
            data: test
        });

    } catch (error) {
        console.error('Create Test Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};


exports.getAllTests = async (req, res) => {
    try {
        const tests = await Test.find({ isPublic: true })
            .populate('reading_sets', 'title difficulty')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: tests.length,
            data: tests
        });
    } catch (error) {
        console.error('Fetch Tests Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error retrieving tests.'
        });
    }
};


exports.getTestById = async (req, res) => {
    try {
        const test = await Test.findById(req.params.id)
            .populate('reading_sets');

        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found' });
        }

        res.status(200).json({
            success: true,
            data: test
        });
    } catch (error) {
        console.error('Fetch Test Preview Error:', error);
        if (error.name === 'CastError') {
            return res.status(404).json({ success: false, message: 'Test not found' });
        }
        res.status(500).json({ success: false, message: 'Server Error retrieving test details.' });
    }
};


exports.getMiniPractice = async (req, res) => {
    try {
        const { difficulty = 'medium' } = req.query;

        const count = await ReadingSet.countDocuments({ difficulty: difficulty });

        if (count === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `No practice passages found for difficulty: ${difficulty}` 
            });
        }

        const random = Math.floor(Math.random() * count);
        const selectedPassage = await ReadingSet.findOne({ difficulty: difficulty }).skip(random);

        const safePassage = selectedPassage.toSafeJSON();

        res.status(200).json({
            success: true,
            data: {
                testId: `mini-${safePassage._id}`, // Generate a fake test ID for routing purposes
                testTitle: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Mini Practice`,
                difficulty: difficulty,
                reading_sets: [safePassage]
            }
        });

    } catch (error) {
        console.error("Mini practice fetch error:", error);
        res.status(500).json({ success: false, message: 'Server error fetching practice material' });
    }
};


exports.getAdaptiveFullTest = async (req, res) => {
    try {
        let userId = req.user ? req.user._id : null;
        let guestId = req.headers['x-guest-id'];
        if (guestId === 'null' || guestId === 'undefined') guestId = null;

        let targetDifficulty = 'Intermediate';
        let avgBand = 0;

        // Analyze User's Past Performance
        const query = userId ? { user: userId } : (guestId ? { guestId: guestId } : null);
        
        if (query) {
            const recentAttempts = await TestAttempt.find({ 
                ...query, 
                totalQuestions: { $gt: 20 } // ignore mini practices
            })
            .sort({ createdAt: -1 })
            .limit(3);

            if (recentAttempts.length > 0) {
                const totalBand = recentAttempts.reduce((sum, att) => sum + (att.bandScore || 0), 0);
                avgBand = totalBand / recentAttempts.length;

                // The Logic Gates
                if (avgBand < 5.5) targetDifficulty = 'Beginner';
                else if (avgBand >= 5.5 && avgBand <= 7.0) targetDifficulty = 'Intermediate';
                else targetDifficulty = 'Advanced';
            }
        }

        let easyCount = 1, medCount = 1, hardCount = 1;
        
        if (targetDifficulty === 'Beginner') {
            easyCount = 2; medCount = 1; hardCount = 0;
        } else if (targetDifficulty === 'Advanced') {
            easyCount = 0; medCount = 1; hardCount = 2;
        }

        const easySets = easyCount > 0 ? await ReadingSet.aggregate([{ $match: { difficulty: 'easy' } }, { $sample: { size: easyCount } }]) : [];
        const medSets = medCount > 0 ? await ReadingSet.aggregate([{ $match: { difficulty: 'medium' } }, { $sample: { size: medCount } }]) : [];
        const hardSets = hardCount > 0 ? await ReadingSet.aggregate([{ $match: { difficulty: 'hard' } }, { $sample: { size: hardCount } }]) : [];

        let customReadingSets = [...easySets, ...medSets, ...hardSets].map(set => set._id);

        if (customReadingSets.length < 3) {
             const backupSets = await ReadingSet.aggregate([{ $sample: { size: 3 } }]);
             customReadingSets = backupSets.map(set => set._id);
        }

        // 5. Create the "Ghost Test" dynamically
        const dynamicTest = await Test.create({
            title: `Personalized Mock Exam (${targetDifficulty})`,
            timeLimit: 60,
            reading_sets: customReadingSets,
            isPublic: false, // Hide from Test Library
        });

        // 6. Send the new Test ID back to the frontend
        res.status(200).json({
            success: true,
            data: {
                testId: dynamicTest._id,
                testTitle: dynamicTest.title,
                difficulty: targetDifficulty,
                message: `Adaptive engine generated a ${targetDifficulty} test based on your history.`
            }
        });

    } catch (error) {
        console.error("Adaptive Test Generation Error:", error);
        res.status(500).json({ success: false, message: 'Server error generating adaptive test' });
    }
};