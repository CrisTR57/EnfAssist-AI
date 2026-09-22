const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined'));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'enfassist-ai-backend'
    });
  });

  app.use('/api/auth', authRoutes);

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}

module.exports = { createApp };
