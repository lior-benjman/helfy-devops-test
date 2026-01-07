const dotenv = require('dotenv');

dotenv.config();

// Splits comma-separated env strings into sanitized arrays (used for CORS origins).
const parseList = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 4001,
  corsOrigins: parseList(process.env.ALLOWED_ORIGINS),
  db: {
    host: process.env.TIDB_HOST || '127.0.0.1',
    port: Number(process.env.TIDB_PORT) || 4000,
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DATABASE || 'flowershop',
    connectionLimit: Number(process.env.TIDB_POOL_SIZE) || 10,
    useSsl: process.env.TIDB_USE_SSL === undefined ? true : process.env.TIDB_USE_SSL !== 'false',
    strictSsl: process.env.TIDB_STRICT_SSL !== 'false',
  },
  auth: {
    tokenTtlHours: Number(process.env.AUTH_TOKEN_TTL_HOURS) || 24,
    defaultUser: {
      email: process.env.DEFAULT_USER_EMAIL || '',
      password: process.env.DEFAULT_USER_PASSWORD || '',
      name: process.env.DEFAULT_USER_NAME || 'Demo Florist',
    },
  },
};
