const express = require('express');
const { verifyLogin, createToken } = require('../services/auth');
const requireAuth = require('../middleware/requireAuth');
const logger = require('../logger');

// Auth router exposes login + token validation endpoints required by the assignment.
const router = express.Router();

// Handles username/password submissions and returns a bearer token on success.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip || 'unknown';

    const user = await verifyLogin(email, password);
    if (!user) {
      // Records every failed attempt so operations has a trail of suspicious access.
      logger.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          action: 'user_login_failed',
          email,
          ip: clientIp,
        }),
      );
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Structured JSON log required by the assignment for successful logins.
    logger.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'user_login',
        userId: user.id,
        ip: clientIp,
      }),
    );

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
