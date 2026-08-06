'use strict';

const axios = require('axios');
const { TEMPLATES } = require('./templates');
const db = require('../db');

const LLM_TIMEOUT = 5000; // 5s timeout

/**
 * Maps a finding to a Tier 1 template key based on category and title clues.
 */
function getTemplateKey(finding) {
  const category = finding.category;
  const title = (finding.title || '').toLowerCase();

  if (category === 'headers') {
    if (title.includes('content-security-policy') || title.includes('csp')) return 'headers::content-security-policy';
    if (title.includes('strict-transport-security') || title.includes('hsts')) return 'headers::strict-transport-security';
    if (title.includes('x-frame-options')) return 'headers::x-frame-options';
    if (title.includes('x-content-type-options')) return 'headers::x-content-type-options';
    if (title.includes('referrer-policy')) return 'headers::referrer-policy';
    if (title.includes('permissions-policy')) return 'headers::permissions-policy';
  }

  if (category === 'ssl') {
    if (title.includes('https not available') || title.includes('no https')) return 'ssl::https_unavailable';
    if (title.includes('expired')) return 'ssl::expired_cert';
    if (title.includes('self-signed') || title.includes('untrusted')) return 'ssl::self_signed';
    if (title.includes('deprecated') || title.includes('weak tls') || title.includes('tls version')) return 'ssl::deprecated_tls';
    if (title.includes('redirect')) {
      if (title.includes('hsts')) return 'ssl::missing_hsts_redirect';
      return 'ssl::no_http_redirect';
    }
  }

  if (category === 'exposed_files' || category === 'config') {
    if (title.includes('.env.production')) return 'exposed_files::exposed_env_production';
    if (title.includes('.env')) return 'exposed_files::exposed_env';
    if (title.includes('pem') || title.includes('certificate') || title.includes('crt')) return 'exposed_files::exposed_pem';
    if (title.includes('ssh') || title.includes('id_rsa') || title.includes('private key')) return 'exposed_files::exposed_ssh';
    if (title.includes('aws') || title.includes('cloud') || title.includes('gcloud') || title.includes('credentials')) return 'exposed_files::exposed_cloud';
    if (title.includes('.git')) return 'exposed_files::exposed_git';
    if (title.includes('.ds_store')) return 'exposed_files::exposed_ds_store';
    if (title.includes('root')) return 'config::dockerfile_root';
    if (title.includes('debug port')) return 'config::dockerfile_debug_port';
    if (title.includes('compose') || title.includes('password')) return 'config::compose_password';
  }

  if (category === 'secrets') {
    if (title.includes('aws') && title.includes('access')) return 'secrets::aws-access-key';
    if (title.includes('aws') && title.includes('secret')) return 'secrets::aws-secret-key';
    if (title.includes('stripe')) return 'secrets::stripe-key';
    if (title.includes('github') || title.includes('pat')) return 'secrets::github-pat';
    if (title.includes('password')) return 'secrets::generic-password';
    if (title.includes('private key') || title.includes('pem')) return 'secrets::private-key-header';
    if (title.includes('token') || title.includes('api key')) return 'secrets::generic-api-key';
  }

  if (category === 'Information Leakage') {
    if (title.includes('verbose server')) return 'checklist::verbose_server';
    if (title.includes('x-powered-by') || title.includes('powered-by')) return 'checklist::powered_by';
    if (title.includes('stack trace')) return 'checklist::stack_trace';
  }

  if (category === 'Secure Authentication') {
    return 'checklist::auth_cookie_insecure';
  }

  if (category === 'Resource Access Control') {
    return 'checklist::idor_exposure';
  }

  if (category === 'Secrets Protection') {
    return 'checklist::secrets_leak';
  }

  if (category === 'Input Validation') {
    if (title.includes('sqli') || title.includes('database parameter')) return 'checklist::sqli_leak';
    return 'checklist::xss_reflected';
  }

  if (category === 'File Upload Safety') {
    return 'checklist::directory_listing_uploads';
  }

  if (category === 'Rate Limiting' || category === 'Abuse Protection') {
    return 'checklist::missing_rate_limiting';
  }

  if (category === 'Secure Deployment') {
    return 'checklist::secure_deployment_missing';
  }

  return null;
}

/**
 * Call the selected LLM API to get dynamic plain-English descriptions.
 */
async function callLlm(finding) {
  const prompt = `You are a senior security engineer. Explain the following security finding in plain, non-jargon English suitable for indie hackers and students.

Finding Data:
- Category: ${finding.category}
- Severity: ${finding.severity}
- Title: ${finding.title}
- Source Tool: ${finding.source_tool || finding.sourceTool}
- Raw Details/Context: ${finding.plain_english_summary || finding.summary || ''}

Your response MUST be a JSON object containing exactly these three fields:
1. "plain_english_summary": A one or two sentence summary in simple plain-English of what the finding is.
2. "real_world_impact": A one or two sentence description of how an attacker would exploit this and the business/system impact (keep it practical, e.g. "An attacker could steal cookies or run up server bills").
3. "fix": A clear, copy-pasteable configuration command, code fix, or step-by-step mitigation.

Return ONLY the raw JSON object. Do not wrap it in markdown code blocks.`;

  // 1. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const resp = await axios.post(url, payload, { timeout: LLM_TIMEOUT });
    const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text.trim());
  }

  // 2. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    };
    const resp = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      timeout: LLM_TIMEOUT
    });
    const text = resp.data?.choices?.[0]?.message?.content;
    return JSON.parse(text.trim());
  }

  // 3. Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    const url = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    };
    const resp = await axios.post(url, payload, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: LLM_TIMEOUT
    });
    const text = resp.data?.content?.[0]?.text;
    return JSON.parse(text.trim());
  }

  throw new Error('No LLM API keys configured');
}

/**
 * Process a finding, applying Tier 1 lookup or falling back to Tier 2 LLM.
 * Returns the enriched finding.
 *
 * @param {import('../schema').Finding} finding
 * @returns {Promise<import('../schema').Finding>}
 */
async function processFinding(finding) {
  // Capture technical details first before rewriting
  const rawDetails = {
    title:       finding.title,
    severity:    finding.severity,
    source_tool: finding.source_tool || finding.sourceTool,
    original_summary: finding.plain_english_summary || finding.summary || '',
  };
  finding.technical_details = JSON.stringify(rawDetails);

  // ─── Tier 1: Rule-Based Lookup ──────────────────────────────────────────────
  const key = getTemplateKey(finding);
  if (key && TEMPLATES[key]) {
    const template = TEMPLATES[key];
    finding.title = template.title;
    finding.plain_english_summary = template.summary;
    finding.real_world_impact = template.impact;
    finding.fix = template.fix;
    return finding;
  }

  // ─── Tier 2: LLM Fallback (With SQLite caching) ──────────────────────────────
  const cacheKey = `${finding.category}::${finding.title.replace(/\s+/g, '-').toLowerCase()}`;

  try {
    const cached = await db.getLlmCache(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached.response_json);
      finding.plain_english_summary = parsed.plain_english_summary;
      finding.real_world_impact = parsed.real_world_impact;
      finding.fix = parsed.fix;
      return finding;
    }
  } catch (err) {
    console.warn('[ExplanationProcessor] Cache read failed:', err.message);
  }

  try {
    const response = await callLlm(finding);
    if (response.plain_english_summary && response.real_world_impact && response.fix) {
      // Save to cache
      try {
        await db.insertLlmCache(cacheKey, JSON.stringify(response));
      } catch (err) {
        console.warn('[ExplanationProcessor] Cache write failed:', err.message);
      }

      finding.plain_english_summary = response.plain_english_summary;
      finding.real_world_impact = response.real_world_impact;
      finding.fix = response.fix;
    }
  } catch (err) {
    console.warn(`[ExplanationProcessor] LLM fallback failed for "${finding.title}":`, err.message);
    // Hard fallback: leave the finding with the original raw metadata, but add a generic note
    finding.plain_english_summary = finding.plain_english_summary || finding.summary || 'We don\'t have a plain-English explanation for this yet.';
    finding.real_world_impact = finding.real_world_impact || 'No impact details available.';
    finding.fix = finding.fix || '# Contact administrator or consult technical details.';
  }

  return finding;
}

module.exports = { processFinding, getTemplateKey };
