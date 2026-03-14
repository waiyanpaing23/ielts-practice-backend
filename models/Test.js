const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a test title'],
    trim: true
  },
  timeLimit: {
    type: Number,
    required: [true, 'Please provide a time limit in minutes'],
    default: 60
  },
  reading_sets: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReadingSet'
    }],
    validate: [arrayLimit, 'An IELTS test must contain exactly 3 reading sets.']
  },
  creator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

function arrayLimit(val) {
  return val.length === 3;
}

const Test = mongoose.model('Test', testSchema);

module.exports = Test;