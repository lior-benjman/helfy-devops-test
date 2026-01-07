const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('./config');

// Single MySQL/TiDB pool reused throughout the app to avoid repeated connection churn.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  ssl: config.db.useSsl
    ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: config.db.strictSsl,
      }
    : undefined,
});

// Starter inventory used to populate TiDB the first time the service runs.
const sampleFlowers = [
  ['Sunflower Delight', 'Yellow', 19.99],
  ['Lavender Breeze', 'Purple', 17.5],
  ['Rose Romance', 'Red', 24.0],
];

async function initDb() {
  await createSchema();
  await seedFlowers();
  await seedDefaultUser();
}

// Ensures all required tables exist before the API starts handling requests.
async function createSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tokens (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      token CHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flowers (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      color VARCHAR(60) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Seeds the flowers table with sample data in empty databases to show activity immediately.
async function seedFlowers() {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM flowers');
  if (rows[0].count === 0) {
    const insertSql = 'INSERT INTO flowers (name, color, price) VALUES ?';
    await pool.query(insertSql, [sampleFlowers]);
  }
}

// Optionally creates a default user (controlled via env vars) for quick logins in dev/test.
async function seedDefaultUser() {
  const { email, password, name } = config.auth.defaultUser;
  if (!email || !password) {
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const existingUsers = await query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);

  const passwordHash = await bcrypt.hash(password, 10);
  if (existingUsers.length > 0) {
    // Keep the account in sync with env overrides when developers change defaults.
    await query('UPDATE users SET password_hash = ?, display_name = ? WHERE id = ?', [
      passwordHash,
      name,
      existingUsers[0].id,
    ]);
  } else {
    await query(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
      [normalizedEmail, passwordHash, name],
    );
  }
}

// Lightweight helper around mysql2's execute to keep other modules terse.
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Used by the health endpoint to confirm we can reach TiDB.
async function ping() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = {
  initDb,
  ping,
  query,
};
