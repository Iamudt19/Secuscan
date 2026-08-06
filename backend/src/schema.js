/**
 * Vulta — Unified Findings Schema & Scoring Logic
 *
 * Every scanner adapter must normalise its raw output into the Finding shape below.
 * This is the core abstraction that makes the plain-English report possible.
 */

'use strict';

/**
 * @typedef {Object} Finding
 * @property {string}  id                   - UUID for this finding
 * @property {string}  scan_id              - Parent scan ID
 * @property {'repo'|'website'} target_type
 * @property {'secrets'|'dependencies'|'headers'|'ssl'|'exposed_files'|'config'} category
 * @property {'critical'|'high'|'medium'|'low'} severity
 * @property {string}  title                - Short technical name
 * @property {string}  plain_english_summary - What this means for a non-security person
 * @property {string}  real_world_impact    - What could realistically happen if exploited
 * @property {string}  fix                  - Copy-pasteable fix (code snippet / command / header config)
 * @property {string}  source_tool          - Which underlying tool produced this
 * @property {Object}  [raw]                - Original raw output (never shown to user)
 */

/**
 * Severity deduction weights for scoring.
 */
const SEVERITY_WEIGHTS = {
  critical: 25,
  high:     10,
  medium:   5,
  low:      1,
};

/**
 * Map a 0-100 numeric score to a letter grade.
 * @param {number} score
 * @returns {'A+'|'A'|'B'|'C'|'D'|'F'}
 */
function scoreToGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

/**
 * Compute an overall security score from a list of findings.
 * Starts at 100 and deducts per finding, clamped to [0, 100].
 *
 * @param {Finding[]} findings
 * @returns {{ score: number, grade: string, counts: Object }}
 */
function scoreFromFindings(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  let total = 100;
  for (const f of findings) {
    const sev = f.severity?.toLowerCase();
    if (SEVERITY_WEIGHTS[sev] !== undefined) {
      counts[sev]++;
      total -= SEVERITY_WEIGHTS[sev];
    }
  }

  const score = Math.max(0, Math.min(100, total));
  return {
    score,
    grade: scoreToGrade(score),
    counts,
  };
}

/**
 * Validate that a Finding object has all required fields.
 * Returns an array of missing field names.
 *
 * @param {Partial<Finding>} finding
 * @returns {string[]}
 */
function validateFinding(finding) {
  const required = [
    'id', 'scan_id', 'target_type', 'category',
    'severity', 'title', 'plain_english_summary',
    'real_world_impact', 'fix', 'source_tool',
  ];
  return required.filter((k) => !finding[k]);
}

module.exports = { scoreFromFindings, scoreToGrade, validateFinding, SEVERITY_WEIGHTS };
