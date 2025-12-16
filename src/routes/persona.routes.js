const express = require('express');
const PersonaController = require('../controllers/persona.controller');

const router = express.Router();
const personaController = new PersonaController();

router.post('/profile', (req, res) => personaController.createProfile(req, res));
router.get('/profile/:address?', (req, res) => personaController.getProfile(req, res));
router.post('/follow', (req, res) => personaController.follow(req, res));
router.post('/unfollow', (req, res) => personaController.unfollow(req, res));
router.post('/verify-identity', (req, res) => personaController.verifyIdentity(req, res));
router.get('/relationships/:address?', (req, res) => personaController.getRelationships(req, res));
router.get('/is-following/:follower/:following', (req, res) => personaController.isFollowing(req, res));

module.exports = router;

