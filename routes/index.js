const express = require('express');
const router = express.Router();

// Auth routes
const authRoutes = require('./authRoutes');
router.use('/auth', authRoutes);

const roomRoutes = require('./roomRoutes');
router.use('/rooms', roomRoutes);

module.exports = router;
