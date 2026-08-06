'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// ─── POST /api/contact ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body ?? {};

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields (name, email, subject, message) are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const id = uuidv4();
    await db.insertContactMessage({
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    console.log(`[Contact] Message received from ${email} (${name})`);
    return res.json({ message: 'Thank you! Your message has been sent to our team.' });
  } catch (err) {
    console.error('[Contact Error]', err);
    return res.status(500).json({ error: 'Failed to save message. Please try again.' });
  }
});

module.exports = router;
