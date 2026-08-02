'use strict';

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { stmts } = require('../db');
const { hashPassword, verifyPassword } = require('../utils/crypto');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

// ─── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!password || !PASSWORD_REGEX.test(password)) {
    return res.status(400).json({
      error: 'Password must be 8-64 characters and contain at least one uppercase letter, one lowercase letter, and one number.'
    });
  }

  try {
    const existing = stmts.getUserByEmail.get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const id = uuidv4();
    const hashed = hashPassword(password);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    stmts.insertUser.run({
      id,
      email: email.toLowerCase().trim(),
      password_hash: hashed,
      verification_token: verifyToken,
      verification_expires: verifyExpires,
    });

    // Simulated email printout inside logs for local verification
    const verifyLink = `http://localhost:5173/verify-email?token=${verifyToken}`;
    console.log('\n✉️================ [EMAIL SIMULATOR: REGISTRATION] ================');
    console.log(`To: ${email}`);
    console.log(`Verify your email link: ${verifyLink}`);
    console.log('=================================================================\n');

    return res.status(201).json({
      message: 'Account registered successfully. Please verify your email (check console logs for link).'
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    return res.status(500).json({ error: 'An error occurred during registration.' });
  }
});

// ─── POST /api/auth/verify ───────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const { token } = req.body ?? {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  try {
    // Look up user with this verification token
    const user = stmts.getUserByEmail.database.prepare(
      `SELECT * FROM users WHERE verification_token = ?`
    ).get(token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    const now = new Date().toISOString();
    if (user.verification_expires < now) {
      return res.status(400).json({ error: 'Verification token has expired. Please register again.' });
    }

    stmts.verifyUser.run(user.id);
    return res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error('[Auth] Verification error:', err);
    return res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = stmts.getUserByEmail.get(email.toLowerCase().trim());
    if (!user) {
      console.warn(`[Auth Audit] Login failed: User email "${email}" not found. IP: ${req.ip}`);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account lockout status (exponential backoff check)
    const now = new Date();
    if (user.locked_until) {
      const lockTime = new Date(user.locked_until);
      if (lockTime > now) {
        const secondsLeft = Math.ceil((lockTime - now) / 1000);
        console.warn(`[Auth Audit] Login blocked: User account "${email}" is currently locked. Try again in ${secondsLeft}s. IP: ${req.ip}`);
        return res.status(423).json({
          error: `Account is temporarily locked due to multiple failed login attempts. Try again in ${secondsLeft} seconds.`
        });
      }
    }

    // Verify password
    const match = verifyPassword(password, user.password_hash);
    if (!match) {
      // Calculate lockout duration based on failed attempts count
      const attempts = user.failed_attempts + 1;
      let lockDelayMs = 0;

      if (attempts === 2) lockDelayMs = 5000;         // 5 seconds
      else if (attempts === 3) lockDelayMs = 15000;    // 15 seconds
      else if (attempts === 4) lockDelayMs = 30000;    // 30 seconds
      else if (attempts >= 5) lockDelayMs = 60000;     // 60 seconds (1 min)

      const lockedUntil = lockDelayMs > 0
        ? new Date(Date.now() + lockDelayMs).toISOString()
        : null;

      stmts.incrementFailedAttempts.run(lockedUntil, user.id);

      console.warn(`[Auth Audit] Login failed: Invalid password for user "${email}" (Attempt #${attempts}). IP: ${req.ip}`);
      if (lockDelayMs > 0) {
        console.warn(`[Auth Audit] Lockout triggered: User account "${email}" locked for ${lockDelayMs / 1000}s due to repeated failures. IP: ${req.ip}`);
        return res.status(423).json({
          error: `Invalid credentials. Too many failed attempts: account locked for ${lockDelayMs / 1000} seconds.`
        });
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Success! Reset attempts
    stmts.resetFailedAttempts.run(user.id);

    // Create session (expires in 24 hours)
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    stmts.insertSession.run(sessionId, user.id, expiresAt);

    // Set secure cookie
    res.setHeader(
      'Set-Cookie',
      `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}; ${
        process.env.NODE_ENV === 'production' ? 'Secure' : ''
      }`
    );

    console.log(`[Auth Audit] Login succeeded: User account "${email}" authenticated successfully. Session issued. IP: ${req.ip}`);

    return res.json({
      message: 'Logged in successfully.',
      user: {
        id: user.id,
        email: user.email,
        isVerified: user.is_verified === 1,
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Authentication failed.' });
  }
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
router.post('/forgot-password', (req, res) => {
  const { email } = req.body ?? {};

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const user = stmts.getUserByEmail.get(email.toLowerCase().trim());
    
    // Always return success even if user not found to prevent user enumeration attacks!
    if (!user) {
      return res.json({ message: 'If the account exists, a password reset link has been printed to logs.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour

    stmts.setResetToken.run(resetToken, resetExpires, user.id);

    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    console.log('\n✉️================ [EMAIL SIMULATOR: PASSWORD RESET] ================');
    console.log(`To: ${email}`);
    console.log(`Reset password link: ${resetLink}`);
    console.log('=================================================================\n');

    return res.json({ message: 'If the account exists, a password reset link has been printed to logs.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    return res.status(500).json({ error: 'Forgot password request failed.' });
  }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body ?? {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Reset token is required.' });
  }

  if (!password || !PASSWORD_REGEX.test(password)) {
    return res.status(400).json({
      error: 'Password must be 8-64 characters and contain at least one uppercase letter, one lowercase letter, and one number.'
    });
  }

  try {
    // Look up user with reset token
    const user = stmts.getUserByEmail.database.prepare(
      `SELECT * FROM users WHERE reset_token = ?`
    ).get(token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    const now = new Date().toISOString();
    if (user.reset_expires < now) {
      return res.status(400).json({ error: 'Reset token has expired.' });
    }

    const hashed = hashPassword(password);
    stmts.resetPassword.run(hashed, user.id);

    return res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const sessionId = req.headers.cookie
    ? req.headers.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('session_id='))?.split('=')[1]
    : null;

  if (sessionId) {
    try {
      stmts.deleteSession.run(sessionId);
    } catch (err) {
      console.error('[Auth] Logout session delete failed:', err.message);
    }
  }

  // Clear cookie
  res.setHeader(
    'Set-Cookie',
    'session_id=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );

  return res.json({ message: 'Logged out successfully.' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
