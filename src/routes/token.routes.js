const express = require('express');
const TokenController = require('../controllers/token.controller');

const router = express.Router();
const tokenController = new TokenController();

// Read endpoints
router.get('/balance/:address', (req, res) => tokenController.getBalance(req, res));
router.get('/info', (req, res) => tokenController.getInfo(req, res));
router.get('/has-role/:role/:address', (req, res) => tokenController.hasRole(req, res));

// Write endpoints
router.post('/mint', (req, res) => tokenController.mint(req, res));
router.post('/batch-mint', (req, res) => tokenController.batchMint(req, res));
router.post('/transfer', (req, res) => tokenController.transfer(req, res));
router.post('/approve-all', (req, res) => tokenController.approveAll(req, res));
router.post('/burn', (req, res) => tokenController.burn(req, res));
router.post('/batch-burn', (req, res) => tokenController.batchBurn(req, res));
router.post('/set-max-supply', (req, res) => tokenController.setMaxSupply(req, res));
router.post('/pause', (req, res) => tokenController.pause(req, res));
router.post('/unpause', (req, res) => tokenController.unpause(req, res));
router.post('/grant-role', (req, res) => tokenController.grantRole(req, res));
router.post('/revoke-role', (req, res) => tokenController.revokeRole(req, res));

module.exports = router;

