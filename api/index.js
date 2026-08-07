'use strict';

// Wrap the entire app require in a try-catch so Vercel gets a proper
// error response instead of FUNCTION_INVOCATION_FAILED
let app;
try {
  app = require('../backend/src/index.js');
} catch (err) {
  // If the app fails to load, create a minimal Express app that
  // returns the actual error so we can debug it
  const express = require('express');
  app = express();
  app.use((req, res) => {
    console.error('[FATAL] App failed to load:', err.message, err.stack);
    res.status(500).json({
      error: 'Backend failed to start: ' + err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });
  });
}

module.exports = app;
