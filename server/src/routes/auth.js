const express = require('express');
const { verifyLogin, createToken } = require('../services/auth');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// Handles username/password submissions and returns a bearer token on success.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await verifyLogin(email, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokenPayload = await createToken(user.id);
    res.json({
      token: tokenPayload.token,
      expiresAt: tokenPayload.expiresAt,
      user,
    });
  } catch (error) {
    next(error);
  }
});

// Simple endpoint so the client can validate an existing token.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
