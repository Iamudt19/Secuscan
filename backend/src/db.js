'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'secuscan.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Migrations ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    api_token  TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scans (
    id           TEXT PRIMARY KEY,
    target_url   TEXT NOT NULL,
    target_type  TEXT NOT NULL CHECK (target_type IN ('repo', 'website')),
    project_name TEXT,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
    error_msg    TEXT,
    score        INTEGER,
    grade        TEXT,
    counts_json  TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS findings (
    id                   TEXT PRIMARY KEY,
    scan_id              TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    target_type          TEXT NOT NULL,
    category             TEXT NOT NULL,
    severity             TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title                TEXT NOT NULL,
    plain_english_summary TEXT NOT NULL,
    real_world_impact    TEXT NOT NULL,
    fix                  TEXT NOT NULL,
    source_tool          TEXT NOT NULL,
    technical_details    TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
  CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

  CREATE TABLE IF NOT EXISTS llm_cache (
    key          TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    email                TEXT UNIQUE NOT NULL,
    password_hash        TEXT NOT NULL,
    failed_attempts      INTEGER NOT NULL DEFAULT 0,
    locked_until         TEXT,
    is_verified          INTEGER NOT NULL DEFAULT 0,
    verification_token   TEXT,
    verification_expires TEXT,
    reset_token          TEXT,
    reset_expires        TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
`);

// Safe migration for existing databases
try {
  db.exec("ALTER TABLE findings ADD COLUMN technical_details TEXT");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec("ALTER TABLE scans ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec("ALTER TABLE projects ADD COLUMN api_token TEXT");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec("ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL");
} catch (e) {
  // Column already exists, ignore
}

// ─── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  // Projects
  insertProject: db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, api_token) VALUES (?, ?, ?)
  `),
  insertProjectWithOwner: db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, api_token, owner_id) VALUES (?, ?, ?, ?)
  `),
  getProjectByName: db.prepare(`SELECT * FROM projects WHERE name = ?`),
  getProjectByNameAndOwner: db.prepare(`SELECT * FROM projects WHERE name = ? AND owner_id = ?`),
  getProject: db.prepare(`SELECT * FROM projects WHERE id = ?`),
  getProjectWithOwner: db.prepare(`SELECT * FROM projects WHERE id = ? AND owner_id = ?`),
  getProjects: db.prepare(`SELECT * FROM projects ORDER BY name ASC`),
  getProjectsByOwner: db.prepare(`SELECT * FROM projects WHERE owner_id = ? ORDER BY name ASC`),
  updateProjectToken: db.prepare(`UPDATE projects SET api_token = ? WHERE id = ?`),
  updateProjectTokenWithOwner: db.prepare(`UPDATE projects SET api_token = ? WHERE id = ? AND owner_id = ?`),

  // Users & Sessions
  insertUser: db.prepare(`
    INSERT INTO users (id, email, password_hash, verification_token, verification_expires)
    VALUES (@id, @email, @password_hash, @verification_token, @verification_expires)
  `),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  getUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  incrementFailedAttempts: db.prepare(`
    UPDATE users SET failed_attempts = failed_attempts + 1, locked_until = ? WHERE id = ?
  `),
  resetFailedAttempts: db.prepare(`
    UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?
  `),
  verifyUser: db.prepare(`
    UPDATE users SET is_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?
  `),
  setResetToken: db.prepare(`
    UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?
  `),
  resetPassword: db.prepare(`
    UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?
  `),
  insertSession: db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)
  `),
  getSession: db.prepare(`SELECT * FROM sessions WHERE id = ?`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE id = ?`),
  deleteExpiredSessions: db.prepare(`DELETE FROM sessions WHERE expires_at < ?`),
  getScansForProject: db.prepare(`
    SELECT * FROM scans WHERE project_id = ? ORDER BY created_at DESC
  `),
  getLatestScansForProject: db.prepare(`
    SELECT s.* FROM scans s
    WHERE s.id = (
      SELECT id FROM scans
      WHERE project_id = ? AND status = 'done' AND target_type = 'repo'
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    ) OR s.id = (
      SELECT id FROM scans
      WHERE project_id = ? AND status = 'done' AND target_type = 'website'
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    )
  `),

  getLlmCache: db.prepare(`SELECT response_json FROM llm_cache WHERE key = ?`),
  insertLlmCache: db.prepare(`
    INSERT OR REPLACE INTO llm_cache (key, response_json) VALUES (?, ?)
  `),

  insertScan: db.prepare(`
    INSERT INTO scans (id, target_url, target_type, project_name, project_id, status)
    VALUES (@id, @target_url, @target_type, @project_name, @project_id, 'pending')
  `),

  updateScanStatus: db.prepare(`
    UPDATE scans SET status = @status, error_msg = @error_msg WHERE id = @id
  `),

  completeScan: db.prepare(`
    UPDATE scans
    SET status = 'done', score = @score, grade = @grade,
        counts_json = @counts_json, completed_at = datetime('now')
    WHERE id = @id
  `),

  failScan: db.prepare(`
    UPDATE scans
    SET status = 'error', error_msg = @error_msg, completed_at = datetime('now')
    WHERE id = @id
  `),

  getScan: db.prepare(`SELECT * FROM scans WHERE id = ?`),

  getFindings: db.prepare(`
    SELECT * FROM findings WHERE scan_id = ?
    ORDER BY CASE severity
      WHEN 'critical' THEN 1
      WHEN 'high'     THEN 2
      WHEN 'medium'   THEN 3
      WHEN 'low'      THEN 4
    END
  `),

  insertFinding: db.prepare(`
    INSERT INTO findings
      (id, scan_id, target_type, category, severity, title,
       plain_english_summary, real_world_impact, fix, source_tool, technical_details)
    VALUES
      (@id, @scan_id, @target_type, @category, @severity, @title,
       @plain_english_summary, @real_world_impact, @fix, @source_tool, @technical_details)
  `),

  getHistory: db.prepare(`
    SELECT id, target_url, target_type, project_name, status, score, grade,
           counts_json, created_at, completed_at
    FROM scans
    ORDER BY created_at DESC
    LIMIT 20
  `),
  getHistoryByOwner: db.prepare(`
    SELECT s.id, s.target_url, s.target_type, s.project_name, s.status, s.score, s.grade,
           s.counts_json, s.created_at, s.completed_at
    FROM scans s
    INNER JOIN projects p ON s.project_id = p.id
    WHERE p.owner_id = ?
    ORDER BY s.created_at DESC
    LIMIT 20
  `),
};

/**
 * Insert multiple findings in a single transaction.
 * @param {import('../src/schema').Finding[]} findings
 */
const insertFindings = db.transaction((findings) => {
  for (const f of findings) {
    stmts.insertFinding.run(f);
  }
});

module.exports = { db, stmts, insertFindings };
