const express = require('express');

const router = express.Router();

// Lazy load DID controller to handle dependency issues gracefully
let didController = null;
let didControllerError = null;

function getDIDController() {
  if (didController) return didController;
  if (didControllerError) throw didControllerError;
  
  try {
    const DIDController = require('../controllers/did.controller');
    didController = new DIDController();
    return didController;
  } catch (error) {
    didControllerError = error;
    console.warn('⚠️  DID Controller failed to initialize:', error.message);
    console.warn('   DID endpoints will return errors. Other endpoints are unaffected.');
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