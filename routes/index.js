const express = require('express');
const router = express.Router();

// Auth routes
const authRoutes = require('./authRoutes');
router.use('/auth', authRoutes);

const userRoutes = require('./userRoutes');
router.use('/users', userRoutes);

const roomRoutes = require('./roomRoutes');
router.use('/rooms', roomRoutes);

const readingSetRoutes = require('./readingSetRoutes');
router.use('/reading-sets', readingSetRoutes);

const testRoutes = require('./testRoutes');
router.use('/tests', testRoutes);

const attemptRoutes = require('./attemptRoutes');
router.use('/attempts', attemptRoutes);

module.exports = router;
