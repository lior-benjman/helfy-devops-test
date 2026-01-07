const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initDb, ping } = require('./db');
const flowersRouter = require('./routes/flowers');
const authRouter = require('./routes/auth');
const requireAuth = require('./middleware/requireAuth');

async function bootstrap() {
  try {
    await initDb();
    await ping();
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }

  const app = express();

  const corsOptions = config.corsOrigins.length
    ? { origin: config.corsOrigins, credentials: true }
    : undefined;

  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/api/health', async (req, res) => {
    try {
      await ping();
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/flowers', requireAuth, flowersRouter);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Unexpected server error' });
  });

  app.listen(config.port, () => {
    console.log(`API server running on http://localhost:${config.port}`);
  });
}

bootstrap();
