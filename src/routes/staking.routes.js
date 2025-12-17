const express = require('express');
const StakingController = require('../controllers/staking.controller');

const router = express.Router();
const stakingController = new StakingController();

// Read endpoints
router.get('/info/:address?', (req, res) => stakingController.getStakingInfo(req, res));
router.get('/contract-info', (req, res) => stakingController.getContractInfo(req, res));
router.get('/has-role/:role/:address', (req, res) => stakingController.hasRole(req, res));

// Write endpoints
router.post('/stake', (req, res) => stakingController.stake(req, res));
router.post('/cooldown', (req, res) => stakingController.startCooldown(req, res));
router.post('/unstake', (req, res) => stakingController.unstake(req, res));
router.post('/claim', (req, res) => stakingController.claimRewards(req, res));
router.post('/notify-reward', (req, res) => stakingController.notifyReward(req, res));
router.post('/set-reward-duration', (req, res) => stakingController.setRewardDuration(req, res));
router.post('/grant-role', (req, res) => stakingController.grantRole(req, res));
router.post('/revoke-role', (req, res) => stakingController.revokeRole(req, res));

module.exports = router;

