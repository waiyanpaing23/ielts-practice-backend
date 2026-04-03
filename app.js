require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');

const http = require('http');
const { Server } = require('socket.io');

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set('io', io);

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', require('./routes'));

// Basic route for testing
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to IELTS Practice Backend API',
    version: '1.0.0'
  });
});

// Socket.io Connection Event Listener
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Listen for a frontend client asking to join a specific room's channel
  socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room: ${roomId}`);
      
      // Tell everyone else in this room that a new student arrived
      socket.to(roomId).emit('student_joined'); 
  });

  socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// 404 
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = server;