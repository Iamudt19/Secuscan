'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');

const scanRouter    = require('./routes/scan');
const historyRouter = require('./routes/history');
const projectsRouter = require('./routes/projects');
const authRouter     = require('./routes/auth');
const { authenticateSession } = require('./middlewares/authMiddleware');

const db = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

// Lazy DB initialisation — runs on first request, works in serverless & local
let dbReady = false;
let dbInitPromise = null;
app.use(async (req, res, next) => {
  if (!dbReady) {
    if (!dbInitPromise) dbInitPromise = db.initDb().then(() => { dbReady = true; });
    try { await dbInitPromise; } catch (err) {
      console.error('[DB Init Error]', err);
      return res.status(500).json({ error: 'Database initialisation failed.' });
    }
  }
  next();
});

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({
  limit: '10kb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Configurable Rate Limiting
const globalWindowMs = parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || '60000', 10);
const globalMax      = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '100', 10);

const scanWindowMs   = parseInt(process.env.RATE_LIMIT_SCAN_WINDOW_MS || '300000', 10);
const scanMax        = parseInt(process.env.RATE_LIMIT_SCAN_MAX || '5', 10);

const projWindowMs   = parseInt(process.env.RATE_LIMIT_PROJECT_WINDOW_MS || '60000', 10);
const projMax        = parseInt(process.env.RATE_LIMIT_PROJECT_MAX || '10', 10);

const authWindowMs   = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10); // 15 min default
const authMax        = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10); // 5 attempts default

// Enable cookie session resolution globally
app.use(authenticateSession);

// Secure Deployment Headers Middleware (replaces Helmet)
app.use((req, res, next) => {
  // Enforce HSTS (Strict-Transport-Security: 2 years, include subdomains)
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  
  // Prevent Clickjacking (X-Frame-Options: DENY)
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent Content-Type Sniffing (X-Content-Type-Options: nosniff)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Restrict Referrer information (Referrer-Policy: no-referrer)
  res.setHeader('Referrer-Policy', 'no-referrer');
  
  // Content Security Policy (CSP) (restricts origins of scripts/objects/styles)
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' http://localhost:3001 http://localhost:5173 https://*; frame-ancestors 'none';");

  next();
});

// Helper: Custom rate-limiter log handler
const rateLimitLogHandler = (limitName) => (req, res, next, options) => {
  console.warn(`[Suspicious Traffic Alert] IP ${req.ip} exceeded rate limit "${limitName}" on ${req.method} ${req.originalUrl}`);
  res.status(options.statusCode).json(options.message);
};

// Global limit (looser, for standard pages)
app.use(rateLimit({
  windowMs: globalWindowMs,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute and try again.' },
  handler: rateLimitLogHandler('global'),
}));

// Scan submission limit (moderate, targets long-running pipelines)
app.use('/api/scan', rateLimit({
  windowMs: scanWindowMs,
  max: scanMax,
  message: { error: 'Scan limit reached. Please wait before submitting another target.' },
  skip: (req) => req.method !== 'POST', // only limit POSTs
  handler: rateLimitLogHandler('scan-submission'),
}));

// Project creation limit (stricter, targets authorization/creation keys)
app.use('/api/projects', rateLimit({
  windowMs: projWindowMs,
  max: projMax,
  message: { error: 'Project configuration limit reached. Please try again later.' },
  skip: (req) => req.method !== 'POST', // only limit POSTs
  handler: rateLimitLogHandler('project-creation'),
}));

// Authentication endpoint limits (strict IP-level throttle for safety)
app.use('/api/auth', rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  skip: (req) => req.method === 'GET', // don't throttle checks to /api/auth/me
  handler: rateLimitLogHandler('authentication'),
}));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', phase: 4 });
});

const contactRouter  = require('./routes/contact');
const adminRouter    = require('./routes/admin');
const featuresRouter = require('./routes/features');

app.use('/api/scan',     scanRouter);
app.use('/api/history',  historyRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/auth',     authRouter);
app.use('/api/contact',  contactRouter);
app.use('/api/admin',    adminRouter);
app.use('/api',          featuresRouter);

// ─── Global Error Handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  const status = err.status ?? 500;
  res.status(status).json({
    error: status === 500
      ? 'An internal server error occurred.'
      : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🔒 Vulta backend running on http://localhost:${PORT}`);
    console.log(`   Phase 1 — website header check adapter active`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;
