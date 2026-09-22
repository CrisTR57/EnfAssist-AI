const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

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

  return app;
}

module.exports = { createApp };
