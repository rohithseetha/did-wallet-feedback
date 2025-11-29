const express = require('express');
const DIDController = require('../controllers/did.controller');

const router = express.Router();
const didController = new DIDController();

// Bind the methods to maintain 'this' context
router.post('/generate', (req, res) => didController.generateDID(req, res));
router.post('/sign', (req, res) => didController.signMessage(req, res));
router.post('/verify', (req, res) => didController.verifySignature(req, res));
router.get('/balance/:address', (req, res) => didController.getBalance(req, res));

// User registration and management
router.post('/register', (req, res) => didController.registerUser(req, res));
router.get('/users', (req, res) => didController.listUsers(req, res));
router.get('/user/:address', (req, res) => didController.getUser(req, res));
router.put('/user/:address', (req, res) => didController.updateUser(req, res));

module.exports = router;