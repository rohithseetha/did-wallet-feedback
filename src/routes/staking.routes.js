const express = require('express');
const StakingController = require('../controllers/staking.controller');

const router = express.Router();
const stakingController = new StakingController();

router.post('/stake', (req, res) => stakingController.stake(req, res));
router.post('/cooldown', (req, res) => stakingController.startCooldown(req, res));
router.post('/unstake', (req, res) => stakingController.unstake(req, res));
router.post('/claim', (req, res) => stakingController.claimRewards(req, res));
router.get('/info/:address?', (req, res) => stakingController.getStakingInfo(req, res));
router.get('/contract-info', (req, res) => stakingController.getContractInfo(req, res));

module.exports = router;

