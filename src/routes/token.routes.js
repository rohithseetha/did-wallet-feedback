const express = require('express');
const TokenController = require('../controllers/token.controller');

const router = express.Router();
const tokenController = new TokenController();

router.get('/balance/:address', (req, res) => tokenController.getBalance(req, res));
router.get('/info', (req, res) => tokenController.getInfo(req, res));
router.post('/mint', (req, res) => tokenController.mint(req, res));
router.post('/transfer', (req, res) => tokenController.transfer(req, res));

module.exports = router;

