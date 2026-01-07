const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { query } = require('../db');

// Dedicated auth helpers keep the route file thin and easier to follow.

// Fetches a user by email (emails are stored lowercase for consistency).
async function findUserByEmail(email) {
  if (!email) return null;
  const normalized = email.toLowerCase();
  const users = await query('SELECT id, email, password_hash, display_name FROM users WHERE email = ?', [
    normalized,
  ]);
  return users[0] || null;
}

// Validates credentials and returns the sanitized user object if the password matches.
async function verifyLogin(email, password) {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
  };
}

// Creates and stores a bearer token tied to a user.
async function createToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.auth.tokenTtlHours * 60 * 60 * 1000);
  await query('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [
    userId,
    token,
    expiresAt,
  ]);

  return { token, expiresAt };
}

// Resolves a token into a user record if it is still valid.
async function getUserForToken(token) {
  if (!token) return null;

  const rows = await query(
    `
    SELECT u.id, u.email, u.display_name
    FROM tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token = ? AND t.expires_at > CURRENT_TIMESTAMP
    `,
    [token],
  );

  return rows[0] || null;
}

module.exports = {
  verifyLogin,
  createToken,
  getUserForToken,
};
