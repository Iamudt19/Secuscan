'use strict';

/**
 * SecuScan — Input Validation Middleware
 *
 * Enforces strict schemas (type, length, format) on all incoming requests
 * to prevent injections, buffer overflows, and format string exploits.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_SHA_REGEX = /^[0-9a-f]{40}$/i;
const PROJECT_NAME_REGEX = /^[a-z0-9\s\-_]{3,50}$/i;

/**
 * Validate that a string is a valid HTTP/HTTPS or GitHub URL.
 */
function isValidUrl(str) {
  if (!str || typeof str !== 'string' || str.length < 10 || str.length > 500) {
    return false;
  }
  try {
    const parsed = new URL(str);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Middleware: Validate GET /api/scan/:id
 */
function validateScanGet(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Invalid Scan ID format. Must be a valid UUID.' });
  }
  next();
}

/**
 * Middleware: Validate POST /api/scan
 */
function validateScanPost(req, res, next) {
  const { url, project_id, project_name } = req.body ?? {};

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL format or length (must be http/https, 10-500 chars).' });
  }

  if (project_id && !UUID_REGEX.test(project_id)) {
    return res.status(400).json({ error: 'Invalid Project ID format.' });
  }

  if (project_name && !PROJECT_NAME_REGEX.test(project_name.trim())) {
    return res.status(400).json({ error: 'Invalid Project Name format (3-50 chars, alphanumeric/spaces/dashes only).' });
  }

  next();
}

/**
 * Middleware: Validate POST /api/scan/ci-scan
 */
function validateCiScanPost(req, res, next) {
  const { repo_url, commit_sha, project_id } = req.body ?? {};

  if (!repo_url || !isValidUrl(repo_url)) {
    return res.status(400).json({ error: 'Invalid repository URL.' });
  }

  if (commit_sha && !HEX_SHA_REGEX.test(commit_sha)) {
    return res.status(400).json({ error: 'Invalid commit SHA format (must be 40-character hex string).' });
  }

  if (!project_id || !UUID_REGEX.test(project_id)) {
    return res.status(400).json({ error: 'Invalid or missing Project ID format.' });
  }

  next();
}

/**
 * Middleware: Validate POST /api/projects
 */
function validateProjectPost(req, res, next) {
  const { name } = req.body ?? {};

  if (!name || typeof name !== 'string' || !PROJECT_NAME_REGEX.test(name.trim())) {
    return res.status(400).json({ error: 'Invalid Project Name format (3-50 chars, alphanumeric/spaces/dashes only).' });
  }

  next();
}

/**
 * Middleware: Validate Project ID parameter
 */
function validateProjectIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Invalid Project ID parameter.' });
  }
  next();
}

module.exports = {
  validateScanGet,
  validateScanPost,
  validateCiScanPost,
  validateProjectPost,
  validateProjectIdParam,
};
