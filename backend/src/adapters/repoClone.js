'use strict';

/**
 * SecuScan — Repo Clone Adapter
 *
 * Shallow-clones a GitHub repository to a temp directory.
 * Enforces:
 *  - 30-second hard timeout on the clone step
 *  - 500 MB size guard (rejects repos over this)
 *  - Automatic cleanup via the returned `cleanup()` function
 */

const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const simpleGit = require('simple-git');

const CLONE_TIMEOUT_MS  = 60_000;  // 60s hard timeout
const MAX_REPO_SIZE_MB  = 500;

/**
 * Parse "github.com/owner/repo" from a full GitHub URL.
 * Returns { owner, repo } or throws.
 */
function parseGithubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?.#]+)/);
  if (!match) throw new Error('Could not parse GitHub repo URL.');
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

/**
 * Shallow-clone a GitHub repo and return the local path + cleanup function.
 *
 * @param {string} repoUrl  Full GitHub URL (https://github.com/owner/repo)
 * @returns {Promise<{ clonePath: string, cleanup: () => void }>}
 */
async function cloneRepo(repoUrl) {
  const { owner, repo } = parseGithubUrl(repoUrl);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `secuscan-${owner}-${repo}-`));

  const git = simpleGit({
    timeout: { block: CLONE_TIMEOUT_MS },
  });

  try {
    await Promise.race([
      git.clone(repoUrl, tmpDir, [
        '--depth', '50',      // last 50 commits — catches recent leaks without full history cost
        '--single-branch',
        '--no-tags',
        '--quiet',
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Clone timed out after ${CLONE_TIMEOUT_MS / 1000}s`)), CLONE_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    // Always clean up tmpDir on failure
    cleanupDir(tmpDir);
    throw err;
  }

  // Size guard: walk the directory and sum file sizes
  const totalMb = getDirSizeMb(tmpDir);
  if (totalMb > MAX_REPO_SIZE_MB) {
    cleanupDir(tmpDir);
    throw new Error(
      `Repo is ${totalMb.toFixed(0)} MB, which exceeds the ${MAX_REPO_SIZE_MB} MB limit.`
    );
  }

  return {
    clonePath: tmpDir,
    cleanup:   () => cleanupDir(tmpDir),
  };
}

/** Recursively calculate directory size in MB (best-effort). */
function getDirSizeMb(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.name === '.git') continue; // skip .git objects for speed
      if (entry.isDirectory()) {
        total += getDirSizeMb(full);
      } else {
        try { total += fs.statSync(full).size; } catch { /* skip */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
  return total / (1024 * 1024);
}

/** Remove a temp directory synchronously (best-effort). */
function cleanupDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[CloneAdapter] cleanup failed for ${dirPath}:`, err.message);
  }
}

module.exports = { cloneRepo, parseGithubUrl };
