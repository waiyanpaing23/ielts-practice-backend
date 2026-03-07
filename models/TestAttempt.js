const mongoose = require('mongoose');

const testAttemptSchema = new mongoose.Schema({
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  room_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null 
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
  userAnswers: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

testAttemptSchema.index({ test: 1, room: 1 });
testAttemptSchema.index({ user: 1 });

const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);

module.exports = TestAttempt;