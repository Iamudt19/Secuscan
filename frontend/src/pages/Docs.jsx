import { useState } from 'react';
import { NodeTracerLine } from '../components/HumanIllustrations';

export default function Docs() {
  const [activeTab, setActiveTab] = useState('generator'); // 'generator' | 'headers' | 'ssl' | 'secrets' | 'cves'
  const [serverType, setServerType] = useState('nginx'); // 'nginx' | 'express' | 'nextjs' | 'apache'
  
  // Header generator toggles
  const [enableHsts, setEnableHsts] = useState(true);
  const [enableCsp, setEnableCsp] = useState(true);
  const [enableFrame, setEnableFrame] = useState(true);
  const [enableContentType, setEnableContentType] = useState(true);
  const [enableReferrer, setEnableReferrer] = useState(true);
  const [enablePermissions, setEnablePermissions] = useState(true);
  const [copied, setCopied] = useState(false);

  // Generate code snippet based on serverType and toggles
  const getGeneratedConfig = () => {
    if (serverType === 'nginx') {
      let lines = ['# SecuScan Recommended Nginx Security Headers'];
      if (enableHsts) lines.push('add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;');
      if (enableCsp) lines.push('add_header Content-Security-Policy "default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\';" always;');
      if (enableFrame) lines.push('add_header X-Frame-Options "DENY" always;');
      if (enableContentType) lines.push('add_header X-Content-Type-Options "nosniff" always;');
      if (enableReferrer) lines.push('add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
      if (enablePermissions) lines.push('add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;');
      return lines.join('\n');
    }

    if (serverType === 'express') {
      let lines = [
        '// SecuScan Express.js Security Headers Middleware',
        'const helmet = require(\'helmet\');',
        'const express = require(\'express\');',
        'const app = express();',
        '',
        'app.use(helmet({',
      ];
      if (enableHsts) lines.push('  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },');
      if (enableCsp) lines.push('  contentSecurityPolicy: { directives: { defaultSrc: ["\'self\'"] } },');
      if (enableFrame) lines.push('  frameguard: { action: \'deny\' },');
      if (enableContentType) lines.push('  noSniff: true,');
      if (enableReferrer) lines.push('  referrerPolicy: { policy: \'strict-origin-when-cross-origin\' },');
      lines.push('}));');
      return lines.join('\n');
    }

    if (serverType === 'nextjs') {
      let lines = [
        '// next.config.js - SecuScan Security Headers',
        'module.exports = {',
        '  async headers() {',
        '    return [{',
        '      source: \'/(.*)\',',
        '      headers: [',
      ];
      if (enableHsts) lines.push('        { key: \'Strict-Transport-Security\', value: \'max-age=31536000; includeSubDomains\' },');
      if (enableCsp) lines.push('        { key: \'Content-Security-Policy\', value: \'default-src \\\'self\\\';\' },');
      if (enableFrame) lines.push('        { key: \'X-Frame-Options\', value: \'DENY\' },');
      if (enableContentType) lines.push('        { key: \'X-Content-Type-Options\', value: \'nosniff\' },');
      lines.push('      ]', '    }];', '  }', '};');
      return lines.join('\n');
    }

    if (serverType === 'apache') {
      let lines = ['# .htaccess - SecuScan Apache Security Headers', '<IfModule mod_headers.c>'];
      if (enableHsts) lines.push('  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"');
      if (enableCsp) lines.push('  Header always set Content-Security-Policy "default-src \'self\';"');
      if (enableFrame) lines.push('  Header always set X-Frame-Options "DENY"');
      if (enableContentType) lines.push('  Header always set X-Content-Type-Options "nosniff"');
      lines.push('</IfModule>');
      return lines.join('\n');
    }

    return '';
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getGeneratedConfig());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
            ✦ // developer_guides &amp; tools
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>
            &lt;security_docs/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '680px' }}>
            Interactive remediation recipes, header generators, and OWASP security compliance checklists for indie hackers and developers.
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
          {[
            { id: 'generator', label: '<header_generator/>' },
            { id: 'headers', label: '<headers_guide/>' },
            { id: 'ssl', label: '<ssl_tls_guide/>' },
            { id: 'secrets', label: '<secret_prevention/>' },
            { id: 'cves', label: '<cve_remediation/>' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(t.id)}
              style={{ fontSize: '0.78rem' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <NodeTracerLine label={`// docs.${activeTab}`} />

        {/* Tab Content 1: Live Security Header Generator */}
        {activeTab === 'generator' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ Live Security Header Generator
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Select your server technology and toggle the security headers you want to generate copy-paste configuration code.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              {/* Server selector */}
              <div>
                <label className="code-tag code-tag--accent" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  // target_server_environment
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'nginx', label: 'Nginx' },
                    { id: 'express', label: 'Express.js (Node)' },
                    { id: 'nextjs', label: 'Next.js' },
                    { id: 'apache', label: 'Apache (.htaccess)' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`btn ${serverType === s.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setServerType(s.id)}
                      style={{ fontSize: '0.78rem' }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.85rem' }}>
                {[
                  { state: enableHsts, set: setEnableHsts, label: 'Strict-Transport-Security (HSTS)', code: 'HSTS' },
                  { state: enableCsp, set: setEnableCsp, label: 'Content-Security-Policy (CSP)', code: 'CSP' },
                  { state: enableFrame, set: setEnableFrame, label: 'X-Frame-Options (Clickjacking)', code: 'X-Frame' },
                  { state: enableContentType, set: setEnableContentType, label: 'X-Content-Type-Options', code: 'MIME' },
                  { state: enableReferrer, set: setEnableReferrer, label: 'Referrer-Policy', code: 'Referrer' },
                  { state: enablePermissions, set: setEnablePermissions, label: 'Permissions-Policy', code: 'Permissions' },
                ].map((item) => (
                  <label
                    key={item.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-panel)',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      color: item.state ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.set(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Generated Code Output Box */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="code-tag code-tag--cyan">// generated_configuration</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCopy}
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem' }}
                  >
                    {copied ? '✓ Copied to Clipboard!' : 'Copy Code Snippet'}
                  </button>
                </div>
                <pre className="finding-card__code" style={{ minHeight: '140px' }}>
                  {getGeneratedConfig()}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: Security Headers Guide */}
        {activeTab === 'headers' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ Security Headers Guide (OWASP Baseline)
            </h2>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {[
                {
                  title: 'Strict-Transport-Security (HSTS)',
                  desc: 'Forces browser to only communicate over encrypted HTTPS connections, shielding users against SSL stripping and man-in-the-middle attacks.',
                  rec: 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload'
                },
                {
                  title: 'Content-Security-Policy (CSP)',
                  desc: 'Restricts script execution to approved domains, blocking Cross-Site Scripting (XSS) and unauthorized data exfiltration.',
                  rec: "Content-Security-Policy: default-src 'self'; script-src 'self' https://trustedscripts.com;"
                },
                {
                  title: 'X-Frame-Options',
                  desc: 'Prevents your web app from being embedded inside an iframe on malicious websites, defeating Clickjacking attacks.',
                  rec: 'X-Frame-Options: DENY'
                },
                {
                  title: 'X-Content-Type-Options',
                  desc: 'Prevents browsers from MIME-sniffing a response away from the declared content-type, stopping executable uploads.',
                  rec: 'X-Content-Type-Options: nosniff'
                }
              ].map((h) => (
                <div key={h.title} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--cyan)', marginBottom: '0.4rem' }}>{h.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{h.desc}</p>
                  <pre className="finding-card__code" style={{ padding: '0.6rem 0.85rem', margin: 0, fontSize: '0.75rem' }}>{h.rec}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 3: SSL/TLS Guide */}
        {activeTab === 'ssl' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ SSL/TLS Hardening Guidelines
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
              Ensure your web server enforces TLS 1.2 or TLS 1.3 and disables legacy, vulnerable protocols like SSLv3, TLS 1.0, and TLS 1.1.
            </p>
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
              <div className="code-tag code-tag--accent" style={{ marginBottom: '0.5rem' }}>// Recommended Nginx SSL Configuration</div>
              <pre className="finding-card__code">
{`ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_timeout 1d;
ssl_session_cache shared:MozSSL:10m;`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab Content 4: Secret Prevention */}
        {activeTab === 'secrets' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ Hardcoded Secret Leak Prevention
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
              Committing API keys, database credentials, or JWT secrets to Git repositories is one of the top causes of cloud data breaches.
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--pink)', marginBottom: '0.5rem' }}>1. Add Pre-commit Hooks</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Install pre-commit secret scanners before pushing code to GitHub:</p>
                <pre className="finding-card__code">pip install pre-commit && pre-commit install</pre>
              </div>
              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--pink)', marginBottom: '0.5rem' }}>2. Git History Purging</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>If a secret was already committed to Git history, use git-filter-repo or BFG Repo-Cleaner:</p>
                <pre className="finding-card__code">bfg --delete-files .env</pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 5: CVE Remediation */}
        {activeTab === 'cves' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ CVE Package Remediation
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
              Vulnerabilities in third-party npm or PyPI packages allow attackers to compromise your backend server via Supply Chain attacks.
            </p>
            <pre className="finding-card__code">
{`# Fix npm package vulnerabilities automatically
npm audit fix --force

# Check Python vulnerabilities with Safety / Pip-audit
pip-audit`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
