const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question_type: {
    type: String,
    required: [true, 'Please provide a question type'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Please provide question content'],
    trim: true
  },
  options: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  correct_answer: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Please provide the correct answer']
  },
  explanation: {
    type: String,
    default: ''
  }
});


const readingSetSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a passage title'],
    trim: true
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Please provide passage content'],
    default: undefined
  },
  isMatchingHeader: {
    type: Boolean,
    default: false
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: [true, 'Please provide a difficulty level for this passage'],
    default: 'medium'
  },
  
  questions: [questionSchema],
  
  creator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

readingSetSchema.methods.toSafeJSON = function() {
  const readingSet = this.toObject();
  
  if (readingSet.questions && readingSet.questions.length > 0) {
    readingSet.questions = readingSet.questions.map(q => {
      delete q.correct_answer;
      delete q.explanation;
      return q;
    });
  }
  
  return readingSet;
};

const ReadingSet = mongoose.model('ReadingSet', readingSetSchema);

module.exports = ReadingSet;