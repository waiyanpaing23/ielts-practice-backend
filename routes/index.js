const express = require('express');
const router = express.Router();

// Auth routes
const authRoutes = require('./authRoutes');
router.use('/auth', authRoutes);

const roomRoutes = require('./roomRoutes');
router.use('/rooms', roomRoutes);

const readingSetRoutes = require('./readingSetRoutes');
router.use('/reading-sets', readingSetRoutes);

const testRoutes = require('./testRoutes');
router.use('/tests', testRoutes);

module.exports = router;
