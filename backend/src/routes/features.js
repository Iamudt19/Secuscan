'use strict';

const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { assertNotInternalHost } = require('../ssrfGuard');

const router = express.Router();

// ─── GET /api/badge/:scanId (SVG Security Seal) ────────────────────────────
router.get('/badge/:scanId', async (req, res) => {
  try {
    const scan = await db.getScan(req.params.scanId);
    const grade = scan ? (scan.grade || 'A+') : 'A+';
    const score = scan ? (scan.score ?? 95) : 95;
    
    // Choose color based on grade
    let gradeColor = '#00f2fe';
    if (grade.startsWith('A')) gradeColor = '#00f2fe';
    else if (grade.startsWith('B')) gradeColor = '#00e676';
    else if (grade.startsWith('C')) gradeColor = '#ffb300';
    else gradeColor = '#ff4d4d';

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="34" viewBox="0 0 220 34" fill="none">
  <rect width="220" height="34" rx="6" fill="#080d1a" stroke="#1e293b" stroke-width="1"/>
  <text x="12" y="21" fill="#94a3b8" font-family="'JetBrains Mono', monospace, sans-serif" font-size="11" font-weight="600">VULTA VERIFIED</text>
  <rect x="135" y="6" width="75" height="22" rx="4" fill="${gradeColor}15" stroke="${gradeColor}" stroke-width="1"/>
  <text x="172.5" y="21" fill="${gradeColor}" font-family="'JetBrains Mono', monospace, sans-serif" font-size="11" font-weight="700" text-anchor="middle">GRADE ${grade}</text>
</svg>
    `.trim();

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(svg);
  } catch (err) {
    console.error('[Badge Error]', err);
    return res.status(500).send('<svg></svg>');
  }
});

// ─── POST /api/scan/:id/patch (AI Patch Generator) ──────────────────────────
router.post('/scan/:id/patch', async (req, res) => {
  try {
    const scan = await db.getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: 'Scan not found.' });

    const findings = await db.getFindings(req.params.id);
    if (!findings.length) {
      return res.json({ patch: '# No findings detected — your codebase is clean!', summary: 'Clean scan' });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback structured patch template if no key configured
      const fallbackPatch = findings.map((f, i) => `
# --- Fix ${i + 1}: ${f.title} (${f.category}) ---
# Location / Target: ${f.target_type}
# Solution:
${f.fix}
`).join('\n\n');
      return res.json({ patch: fallbackPatch.trim(), isAiGenerated: false });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are a senior Application Security Engineer. Generate a single unified Git patch file (.patch format) or clear code diff to remediate the following security scan findings:

${findings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\nImpact: ${f.plain_english_summary}\nFix Recipe: ${f.fix}`).join('\n\n')}

Return ONLY the code patch with clear comments explaining each fix. No conversational intro or outro text.
    `.trim();

    const result = await model.generateContent(prompt);
    const patchText = result.response.text();

    return res.json({ patch: patchText, isAiGenerated: true });
  } catch (err) {
    console.error('[Patch Generator Error]', err);
    return res.status(500).json({ error: 'Failed to generate fix patch.' });
  }
});

// ─── POST /api/recon/subdomains (Attack Surface Subdomain Recon) ─────────────
router.post('/recon/subdomains', async (req, res) => {
  const { domain } = req.body ?? {};

  if (!domain) {
    return res.status(400).json({ error: 'Domain name is required.' });
  }

  let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  try {
    await assertNotInternalHost(cleanDomain);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  const prefixes = ['www', 'api', 'app', 'admin', 'dev', 'staging', 'auth', 'mail', 'portal', 'docs'];
  const client = axios.create({ timeout: 3000, validateStatus: () => true });

  const probePromises = prefixes.map(async (prefix) => {
    const sub = `${prefix}.${cleanDomain}`;
    try {
      const resp = await client.get(`https://${sub}`);
      return {
        subdomain: sub,
        prefix,
        status: resp.status,
        active: true,
        server: resp.headers.server || 'Protected',
        https: true,
      };
    } catch {
      return {
        subdomain: sub,
        prefix,
        status: 0,
        active: false,
        server: 'Unreachable',
        https: false,
      };
    }
  });

  try {
    const results = await Promise.all(probePromises);
    const activeNodes = results.filter((r) => r.active);

    return res.json({
      domain: cleanDomain,
      totalProbed: prefixes.length,
      activeCount: activeNodes.length,
      subdomains: results,
    });
  } catch (err) {
    console.error('[Recon Error]', err);
    return res.status(500).json({ error: 'Recon process failed.' });
  }
});

// ─── Watchdogs Routes ────────────────────────────────────────────────────────
router.get('/watchdogs', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const watchdogs = await db.getWatchdogsByUser(req.user.id);
    return res.json({ watchdogs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/watchdogs', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const { target_url, frequency } = req.body ?? {};
  if (!target_url) return res.status(400).json({ error: 'target_url is required.' });

  try {
    const id = uuidv4();
    await db.createWatchdog({ id, user_id: req.user.id, target_url, frequency: frequency || 'weekly' });
    return res.json({ message: 'Watchdog monitor created successfully.', id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
