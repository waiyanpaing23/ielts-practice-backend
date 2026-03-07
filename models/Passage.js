const mongoose = require('mongoose');

const passageSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// Method to get passage without sensitive data (if any)
passageSchema.methods.toJSON = function() {
  const passage = this.toObject();
  return passage;
};

const Passage = mongoose.model('Passage', passageSchema);

module.exports = Passage;
