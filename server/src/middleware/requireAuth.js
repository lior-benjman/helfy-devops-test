const { getUserForToken } = require('../services/auth');

// Middleware module centralizes token validation logic for any protected route.

// Express middleware that validates bearer tokens and attaches the user to the request.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, rawToken] = header.split(' ');
    const token = rawToken && rawToken.trim();

    if (!token) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }

    const user = await getUserForToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = requireAuth;
