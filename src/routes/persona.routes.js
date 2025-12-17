const express = require('express');
const PersonaController = require('../controllers/persona.controller');

const router = express.Router();
const personaController = new PersonaController();

// Read endpoints
router.get('/profile/:address?', (req, res) => personaController.getProfile(req, res));
router.get('/following/:address?', (req, res) => personaController.getFollowing(req, res));
router.get('/followers/:address?', (req, res) => personaController.getFollowers(req, res));
router.get('/relationships/:address?', (req, res) => personaController.getRelationships(req, res));
router.get('/user-relationships/:address?', (req, res) => personaController.getUserRelationships(req, res));
router.get('/relationship/:tokenId', (req, res) => personaController.getRelationship(req, res));
router.get('/is-following/:follower/:following', (req, res) => personaController.isFollowing(req, res));
router.get('/identity-verified/:address/:platform', (req, res) => personaController.isIdentityVerified(req, res));
router.get('/constants', (req, res) => personaController.getConstants(req, res));
router.get('/has-role/:role/:address', (req, res) => personaController.hasRole(req, res));

// Write endpoints
router.post('/profile', (req, res) => personaController.createProfile(req, res));
router.post('/follow', (req, res) => personaController.follow(req, res));
router.post('/unfollow', (req, res) => personaController.unfollow(req, res));
router.post('/verify-identity', (req, res) => personaController.verifyIdentity(req, res));
router.post('/relationship', (req, res) => personaController.createRelationship(req, res));
router.post('/update-reputation', (req, res) => personaController.updateReputation(req, res));
router.post('/grant-role', (req, res) => personaController.grantRole(req, res));
router.post('/revoke-role', (req, res) => personaController.revokeRole(req, res));

module.exports = router;

