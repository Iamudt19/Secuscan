'use strict';

const { stmts } = require('../db');

/**
 * Session Authentication Middleware
 *
 * Checks incoming cookies or authorization headers for valid session IDs.
 * Attaches the user record to req.user and the session ID to req.sessionId.
 */
async function authenticateSession(req, res, next) {
  // Extract token from cookie (session_id) or Bearer authorization header
  let sessionId = null;

  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session_id='));
    if (sessionCookie) {
      sessionId = sessionCookie.split('=')[1];
    }
  }

  if (!sessionId && req.headers.authorization?.startsWith('Bearer ')) {
    sessionId = req.headers.authorization.split(' ')[1];
  }

  if (!sessionId) {
    req.user = null;
    req.sessionId = null;
    return next();
  }

  try {
    const session = stmts.getSession.get(sessionId);
    if (!session) {
      req.user = null;
      req.sessionId = null;
      return next();
    }

    const now = new Date().toISOString();
    if (session.expires_at < now) {
      // Expired! Clean it up
      stmts.deleteSession.run(sessionId);
      req.user = null;
      req.sessionId = null;
      return next();
    }

    // Load user
    const user = stmts.getUserById.get(session.user_id);
    if (!user) {
      req.user = null;
      req.sessionId = null;
      return next();
    }

    // Attach to request
    req.user = {
      id: user.id,
      email: user.email,
      isVerified: user.is_verified === 1,
    };
    req.sessionId = sessionId;
    next();
  } catch (err) {
    console.error('[AuthMiddleware] Verification error:', err.message);
    req.user = null;
    req.sessionId = null;
    next();
  }
}

/**
 * Route protection guard: Blocks unauthenticated requests.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/**
 * Route protection guard: Blocks unverified email accounts.
 */
function requireEmailVerification(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (!req.user.isVerified) {
    return res.status(403).json({ error: 'Email verification required. Please check your inbox (or server console logs).' });
  }
  next();
}

module.exports = {
  authenticateSession,
  requireAuth,
  requireEmailVerification,
};
