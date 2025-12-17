const express = require('express');

const router = express.Router();

// Lazy load DID controller to handle dependency issues gracefully
let didController = null;
let didControllerError = null;
let lastInitAttempt = 0;
const RETRY_INTERVAL = 5000; // Retry initialization every 5 seconds if it failed

function getDIDController() {
  // If we have a controller, return it
  if (didController) return didController;
  
  // If we had an error recently, don't retry too often
  const now = Date.now();
  if (didControllerError && (now - lastInitAttempt) < RETRY_INTERVAL) {
    throw didControllerError;
  }
  
  // Try to initialize
  try {
    const DIDController = require('../controllers/did.controller');
    didController = new DIDController();
    didControllerError = null; // Clear any previous error
    lastInitAttempt = now;
    return didController;
  } catch (error) {
    didControllerError = error;
    lastInitAttempt = now;
    console.warn('⚠️  DID Controller failed to initialize:', error.message);
    console.warn('   DID endpoints will return errors. Other endpoints are unaffected.');
    console.warn('   Will retry initialization in 5 seconds...');
    throw error;
  }
}

// Error handler for DID endpoints
function handleDIDError(req, res, error) {
  res.status(503).json({
    success: false,
    error: 'DID service unavailable',
    message: 'DID controller failed to initialize. This may be due to dependency conflicts.',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

// Bind the methods to maintain 'this' context
router.post('/generate', (req, res) => {
  try {
    const controller = getDIDController();
    controller.generateDID(req, res);
  } catch (error) {
    handleDIDError(req, res, error);
  }
});

router.post('/sign', (req, res) => {
  try {
    const controller = getDIDController();
    controller.signMessage(req, res);
  } catch (error) {
    handleDIDError(req, res, error);
  }
});

router.post('/verify', (req, res) => {
  try {
    const controller = getDIDController();
    controller.verifySignature(req, res);
  } catch (error) {
    handleDIDError(req, res, error);
  }
});

router.get('/balance/:address', (req, res) => {
  try {
    const controller = getDIDController();
    controller.getBalance(req, res);
  } catch (error) {
    handleDIDError(req, res, error);
  }
});

module.exports = router;