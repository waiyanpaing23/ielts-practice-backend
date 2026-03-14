const Test = require('../models/Test');
const ReadingSet = require('../models/ReadingSet');

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
        const tests = await Test.find()
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