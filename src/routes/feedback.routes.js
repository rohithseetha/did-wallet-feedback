const express = require('express');
const FeedbackController = require('../controllers/feedback.controller');

const router = express.Router();
const feedbackController = new FeedbackController();

router.post('/submit', (req, res) => feedbackController.submitFeedback(req, res));
router.get('/list', (req, res) => feedbackController.getFeedbacks(req, res));
router.get('/reputation/:did', (req, res) => feedbackController.getReputation(req, res));

module.exports = router;