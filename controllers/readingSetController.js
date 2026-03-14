const ReadingSet = require("../models/ReadingSet");

exports.createReadingSet = async (req, res) => {
    try {
        const { title, content, isMatchingHeader, difficulty, questions } = req.body;

        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide a title and passage content' 
            });
        }

        const readingSet = await ReadingSet.create({
            title,
            content,
            isMatchingHeader: isMatchingHeader || false,
            difficulty: difficulty || 'medium',
            questions: questions || [],
            creator_id: req.user.id
        });

        res.status(201).json({
            success: true,
            message: 'Reading Set created successfully.',
            data: readingSet
        })

    } catch (error) {
        console.error('Create Reading Set Error:', error)
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        })
    }
}

exports.getReadingSets = async (req, res) => {
    try {
        const filter = {};
        if (req.query.difficulty) {
            filter.difficulty = req.query.difficulty;
        }

        const readingSets = await ReadingSet.find(filter).sort({ createdAt: -1});

        res.status(200).json({
            success: true,
            count: readingSets.length,
            data: readingSets
        })
    } catch (error) {
        console.error('Get Reading Sets Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}


exports.getReadingSetById = async (req, res) => {
    try {
        const readingSet = await ReadingSet.findById(req.params.id);

        if (!readingSet) {
            return res.status(404).json({
                success: false,
                message: 'Reading Set not found.'
            })
        }

        res.status(200).json({
            success: true,
            data: readingSet
        })

    } catch (error) {
        console.error('Get Reading Set Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}