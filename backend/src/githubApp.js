'use strict';

const jwt = require('jsonwebtoken');
const axios = require('axios');
const { stmts } = require('./db');

const GITHUB_API_URL = 'https://api.github.com';

/**
 * Generate a JWT token for the GitHub App.
 */
function getAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    return null;
  }

  // Token expires in 10 minutes (GitHub maximum)
  const payload = {
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 600,
    iss: appId,
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

/**
 * Fetch installation access token from GitHub App.
 */
async function getInstallationAccessToken(installationId) {
  const token = getAppJwt();
  if (!token) return null;

  try {
    const res = await axios.post(
      `${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    return res.data.token;
  } catch (err) {
    console.error('[GitHubApp] Failed to get installation token:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Format findings list into a beautiful GitHub comment.
 * Includes collapsible details for scannability.
 */
function formatPrCommentMarkdown(projectName, score, repoFindings, websiteFindings) {
  let markdown = `## 🔒 SecuScan Security Report — **${projectName}**\n\n`;

  // Score emoji + badge
  let scoreEmoji = '🔴';
  if (score >= 80) scoreEmoji = '🟢';
  else if (score >= 60) scoreEmoji = '🟡';

  markdown += `### **Security Score: ${scoreEmoji} ${score}/100**\n`;
  markdown += `*This check was automated by the SecuScan PR Monitor integration.*\n\n`;

  // Code Findings section
  markdown += `### 🐙 Code Security Audits (${repoFindings.length} issue${repoFindings.length !== 1 ? 's' : ''})\n`;
  if (repoFindings.length === 0) {
    markdown += `✅ **No repository findings!** Codebase checked clean of committed secrets and outdated packages.\n\n`;
  } else {
    const grouped = { critical: [], high: [], medium: [], low: [] };
    for (const f of repoFindings) {
      const sev = f.severity?.toLowerCase() || 'low';
      if (grouped[sev]) grouped[sev].push(f);
    }

    for (const [sev, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;

      const isCollapsed = ['medium', 'low'].includes(sev);
      const sevEmoji = sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🟡' : '🔵';

      markdown += `<details ${isCollapsed ? '' : 'open'}>\n`;
      markdown += `<summary><strong>${sevEmoji} ${sev.toUpperCase()} (${items.length})</strong></summary>\n\n`;

      for (const item of items) {
        markdown += `#### 🔍 ${item.title}\n`;
        markdown += `* **What this means:** ${item.plain_english_summary || item.summary}\n`;
        markdown += `* **Real-world impact:** ⚡ ${item.real_world_impact || item.impact}\n`;
        markdown += `* **How to fix it:**\n\`\`\`\n${item.fix}\n\`\`\`\n\n`;
      }

      markdown += `</details>\n\n`;
    }
  }

  // Website Findings section
  markdown += `### 🌐 Live Deployment Posture\n`;
  if (!websiteFindings) {
    markdown += `ℹ️ *No live website linked to this project dashboard. Re-run scans under project context to view live results.*\n\n`;
  } else if (websiteFindings.length === 0) {
    markdown += `✅ **No live website findings!** Live SSL check and header check are fully secure.\n\n`;
  } else {
    markdown += `⚠️ **Found ${websiteFindings.length} live issues** on your deployment target:\n\n`;
    
    const grouped = { critical: [], high: [], medium: [], low: [] };
    for (const f of websiteFindings) {
      const sev = f.severity?.toLowerCase() || 'low';
      if (grouped[sev]) grouped[sev].push(f);
    }

    for (const [sev, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;

      const isCollapsed = ['medium', 'low'].includes(sev);
      const sevEmoji = sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🟡' : '🔵';

      markdown += `<details ${isCollapsed ? '' : 'open'}>\n`;
      markdown += `<summary><strong>${sevEmoji} ${sev.toUpperCase()} (${items.length})</strong></summary>\n\n`;

      for (const item of items) {
        markdown += `#### 🔍 ${item.title}\n`;
        markdown += `* **What this means:** ${item.plain_english_summary || item.summary}\n`;
        markdown += `* **Real-world impact:** ⚡ ${item.real_world_impact || item.impact}\n`;
        markdown += `* **How to fix it:**\n\`\`\`\n${item.fix}\n\`\`\`\n\n`;
      }

      markdown += `</details>\n\n`;
    }
  }

  markdown += `---\n`;
  markdown += `*Fix issues today to prevent compromise. View the full combined dashboard inside [SecuScan Portal](http://localhost:5173).*`;

  return markdown;
}

/**
 * Post comment and Check Run status on a Pull Request.
 */
async function postGithubFeedback({
  owner,
  repo,
  prNumber,
  commitSha,
  projectName,
  score,
  repoFindings,
  websiteFindings,
  installationId,
}) {
  const commentBody = formatPrCommentMarkdown(projectName, score, repoFindings, websiteFindings);

  const token = await getInstallationAccessToken(installationId);
  if (!token) {
    // Mock simulation mode! Log feedback markdown to verify format cleanly
    console.log('\n================ [GITHUB APP SIMULATOR COMMENT] ================');
    console.log(`Repository: ${owner}/${repo} | PR #${prNumber} | Commit: ${commitSha}`);
    console.log(commentBody);
    console.log('=================================================================\n');
    return { success: true, simulated: true };
  }

  try {
    // 1. Post PR Comment
    await axios.post(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body: commentBody },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    // 2. Post status check run
    const conclusion = score >= 80 ? 'success' : 'failure';
    await axios.post(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/check-runs`,
      {
        name: 'SecuScan Audit',
        head_sha: commitSha,
        status: 'completed',
        conclusion: conclusion,
        completed_at: new Date().toISOString(),
        output: {
          title: `SecuScan Score: ${score}/100`,
          summary: `SecuScan completed checking codebase. Found ${repoFindings.length} issue(s).`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    return { success: true, simulated: false };
  } catch (err) {
    console.error('[GitHubApp] Failed to post feedback:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  postGithubFeedback,
  formatPrCommentMarkdown,
};
