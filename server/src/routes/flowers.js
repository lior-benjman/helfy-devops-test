const express = require('express');
const { query } = require('../db');

const router = express.Router();

// Returns the newest flowers first so the UI can show recent inventory activity.
router.get('/', async (req, res, next) => {
  try {
    const flowers = await query(
      `SELECT id, name, color, price, created_at
       FROM flowers
       ORDER BY created_at DESC`,
    );
    res.json(flowers);
  } catch (error) {
    next(error);
  }
});

// Persists a new flower record into TiDB after basic validation.
router.post('/', async (req, res, next) => {
  const { name, color, price } = req.body;
  if (!name || !color || price === undefined) {
    return res.status(400).json({ message: 'name, color and price are required' });
  }

  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice) || numericPrice <= 0) {
    return res.status(400).json({ message: 'price must be a number greater than 0' });
  }

  try {
    const result = await query(
      'INSERT INTO flowers (name, color, price) VALUES (?, ?, ?)',
      [name, color, numericPrice],
    );
    const [inserted] = await query('SELECT * FROM flowers WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
