const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  did: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  profile: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true // Automatically manages createdAt and updatedAt
});

const User = mongoose.model('User', userSchema);

module.exports = User;

