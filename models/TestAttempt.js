const mongoose = require('mongoose');

const testAttemptSchema = new mongoose.Schema({
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  guestId: {
    type: String,
    default: null
  },
  room_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null 
  },
  totalQuestions: {
    type: Number,
    required: true,
    default: 0
  },
  score: {
    type: Number,
    default: 0 // For the percentage (e.g., 85)
  },
  rawScore: {
    type: Number,
    required: true,
    default: 0 // e.g., 34 (out of 40)
  },
  bandScore: {
    type: Number,
    required: true,
    default: 0 // e.g., 7.5
  },
  timeSpent: {
    type: Number,
    default: 0 // In seconds
  },
  userAnswers: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  analysis: [{
    type: mongoose.Schema.Types.Mixed 
  }],
}, {
  timestamps: true
});

testAttemptSchema.index({ test: 1, room: 1 });
testAttemptSchema.index({ user: 1 });

const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);

testAttemptSchema.index(
  { createdAt: 1 }, 
  { 
    expireAfterSeconds: 604800, 
    partialFilterExpression: { user: null } 
  }
);

module.exports = TestAttempt;