const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  passage_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Passage',
    required: [true, 'Please provide a passage ID']
  },
  question_type: {
    type: String,
    required: [true, 'Please provide a question type'],
    // enum: [
    //   'multiple_choice',
    //   'true_false_not_given',
    //   'matching_headings',
    //   'sentence_completion',
    //   'short_answer',
    //   'diagram_labeling',
    //   'matching_information',
    //   'matching_features',
    //   'matching_sentence_endings'
    // ],
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
  }
}, {
  timestamps: true
});

// Method to get question without correct answer (for quiz display)
questionSchema.methods.toSafeJSON = function() {
  const question = this.toObject();
  delete question.correct_answer;
  return question;
};

// Method to get question with all fields
questionSchema.methods.toJSON = function() {
  const question = this.toObject();
  return question;
};

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
