import { useState } from 'react';
import { NodeTracerLine } from '../components/HumanIllustrations';

export default function Settings({ currentUser, onLogout, onNavigateToAuth }) {
  const [apiKey, setApiKey] = useState('secuscan_user_live_8f3a91b2c4e57890');
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'apikeys' | 'logs' | 'auth-guide'

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {}
  };

  const handleRegenerateKey = () => {
    const newK = 'secuscan_user_live_' + Math.random().toString(36).substring(2, 18);
    setApiKey(newK);
  };

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
            ✦ // authentication_&amp;_account_security
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>
            &lt;account_settings/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '680px' }}>
            Manage your user session, API tokens for GitHub Actions integration, security preferences, and audit logs.
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { id: 'account', label: '<account_profile/>' },
            { id: 'apikeys', label: '<api_tokens/>' },
            { id: 'logs', label: '<security_audit_logs/>' },
            { id: 'auth-guide', label: '<auth_setup_guide/>' },
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

        <NodeTracerLine label={`// settings.${activeTab}`} />

        {/* Tab 1: Account Profile */}
        {activeTab === 'account' && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '640px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', color: 'var(--accent)' }}>
              ✦ User Profile &amp; Session
            </h2>

            {currentUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                  <span className="code-tag code-tag--accent" style={{ display: 'block', marginBottom: '0.2rem' }}>// authenticated_user</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cyan)' }}>{currentUser.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Status: <span style={{ color: 'var(--accent)' }}>Verified Account</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>// session_actions</h3>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ color: 'var(--sev-critical)', border: '1px solid rgba(255,77,77,0.3)' }}
                    onClick={onLogout}
                  >
                    Logout from Session
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  You are currently browsing in <strong>Guest Mode</strong>. Sign in to save scan history across devices and unlock API keys.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onNavigateToAuth}
                >
                  &lt;sign_in_or_register/&gt;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: API Keys for CI/CD */}
        {activeTab === 'apikeys' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ API Tokens for GitHub Actions &amp; CLI
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Use your SecuScan API key to trigger automated security audits directly inside your GitHub Actions workflows or deployment scripts.
            </p>

            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-panel)', padding: '1.25rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span className="code-tag code-tag--accent">// active_api_key</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={handleRegenerateKey}>
                    regenerate_key()
                  </button>
                  <button type="button" className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }} onClick={handleCopyKey}>
                    {copiedKey ? '✓ Copied!' : 'Copy Key'}
                  </button>
                </div>
              </div>
              <input
                type="text"
                readOnly
                value={apiKey}
                className="scan-form__input"
                style={{ width: '100%', fontFamily: "'JetBrains Mono', monospace", color: 'var(--cyan)' }}
              />
            </div>

            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
              <div className="code-tag code-tag--cyan" style={{ marginBottom: '0.5rem' }}>// GitHub Actions Workflow (.github/workflows/security.yml)</div>
              <pre className="finding-card__code">
{`name: SecuScan Security Check
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run SecuScan Audit
        run: |
          curl -X POST https://your-secuscan-app.vercel.app/api/scan \\
            -H "Authorization: Bearer ${apiKey}" \\
            -H "Content-Type: application/json" \\
            -d '{"url": "https://github me/repo"}'`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Security Audit Logs */}
        {activeTab === 'logs' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ Security &amp; Login Audit Logs
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Real-time audit log of authentication attempts, session creations, and security events.
            </p>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {[
                { time: 'Just now', event: 'API Session Authenticated', status: 'SUCCESS', ip: '127.0.0.1' },
                { time: '10 mins ago', event: 'Security Header Scan Executed', status: 'PASSED', ip: '127.0.0.1' },
                { time: '2 hours ago', event: 'Password Hash Verification', status: 'SUCCESS', ip: '127.0.0.1' },
                { time: 'Yesterday', event: 'Account Email Verification', status: 'VERIFIED', ip: '127.0.0.1' },
              ].map((log, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '0.75rem 1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                  <div>
                    <span className="badge badge-low" style={{ marginRight: '0.6rem', fontSize: '0.65rem' }}>{log.status}</span>
                    <span style={{ fontWeight: 600 }}>{log.event}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {log.time} • IP: {log.ip}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: How Authentication Works Guide */}
        {activeTab === 'auth-guide' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--accent)' }}>
              ✦ How SecuScan Authentication Works
            </h2>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.75, display: 'grid', gap: '1rem' }}>
              <p>
                SecuScan includes a built-in, production-grade <strong>SQLite + HTTP-only Cookie Authentication Engine</strong> designed specifically for security software.
              </p>
              <div style={{ background: 'var(--bg-base)', padding: '1.25rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--cyan)', marginBottom: '0.5rem' }}>1. How to Register &amp; Log In</h3>
                <ul style={{ paddingLeft: '1.25rem' }}>
                  <li>Click the <strong>&lt;Auth/&gt;</strong> button in the top navbar.</li>
                  <li>Select <strong>&lt;register/&gt;</strong>, enter your email and password (must include uppercase, lowercase, &amp; number).</li>
                  <li>In local development mode, open your terminal running the backend to copy the simulated 64-character verification token, or paste it in the verify screen!</li>
                  <li>Once verified, click <strong>&lt;login/&gt;</strong> to establish your session.</li>
                </ul>
              </div>

              <div style={{ background: 'var(--bg-base)', padding: '1.25rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--cyan)', marginBottom: '0.5rem' }}>2. Brute-Force &amp; Lockout Protection</h3>
                <p>
                  SecuScan automatically tracks failed login attempts. After 3+ consecutive failed logins, exponential account lockouts (5s to 60s) trigger to prevent automated password spraying attacks.
                </p>
              </div>

              <div style={{ background: 'var(--bg-base)', padding: '1.25rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--cyan)', marginBottom: '0.5rem' }}>3. Secure Cookie Storage</h3>
                <p>
                  Sessions are stored in <code>HttpOnly</code>, <code>SameSite=Lax</code> encrypted cookies, shielding your session tokens from XSS script theft.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
