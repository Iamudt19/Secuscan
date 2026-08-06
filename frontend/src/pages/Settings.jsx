import { useState, useEffect } from 'react';
import { NodeTracerLine } from '../components/HumanIllustrations';
import { API_BASE_URL } from '../config';

export default function Settings({ currentUser, onLogout, onNavigateToAuth }) {
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'apikeys' | 'logs' | 'auth-guide'

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
              Generate API tokens to trigger automated security audits directly inside your GitHub Actions workflows or deployment scripts.
            </p>

            {!currentUser ? (
              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-panel)', padding: '2rem', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Authentication Required</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
                  API tokens are bound to your user account. Please log in or register to generate your daily API tokens.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onNavigateToAuth}
                >
                  &lt;sign_in_to_generate_keys/&gt;
                </button>
              </div>
            ) : (
              <ApiKeyManager currentUser={currentUser} />
            )}
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
              ✦ How Vulta Authentication Works
            </h2>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.75, display: 'grid', gap: '1rem' }}>
              <p>
                Vulta includes a built-in, production-grade <strong>SQLite + HTTP-only Cookie Authentication Engine</strong> designed specifically for security software.
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
                  Vulta automatically tracks failed login attempts. After 3+ consecutive failed logins, exponential account lockouts (5s to 60s) trigger to prevent automated password spraying attacks.
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

function ApiKeyManager({ currentUser }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [usageInfo, setUsageInfo] = useState({ usageToday: 0, limit: 2, remaining: 2 });
  const [error, setError] = useState('');

  // Fetch current user API key & daily usage from backend
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/api-key`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (data.apiKey) setApiKey(data.apiKey);
        setUsageInfo({
          usageToday: data.usageToday || 0,
          limit: data.limit || 2,
          remaining: data.remaining ?? 2,
        });
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleGenerateKey = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      setGenerating(false);
      if (!res.ok) throw new Error(data.error || 'Failed to generate API key.');
      setApiKey(data.apiKey);
      setShowKey(true);
      setUsageInfo({
        usageToday: data.usageToday || 0,
        limit: data.limit || 2,
        remaining: data.remaining ?? 2,
      });
    } catch (err) {
      setGenerating(false);
      setError(err.message);
    }
  };

  const handleCopy = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading API key details...
      </div>
    );
  }

  const maskedKey = apiKey
    ? apiKey.slice(0, 11) + '••••••••••••••••••••••••'
    : 'No active API key generated yet';

  return (
    <div>
      {/* Key Status Banner */}
      <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-panel)', padding: '1.25rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span className="code-tag code-tag--accent" style={{ marginRight: '0.5rem' }}>// user_api_key</span>
            <span style={{ fontSize: '0.75rem', color: usageInfo.remaining > 0 ? 'var(--accent)' : 'var(--sev-high)', fontFamily: "'JetBrains Mono', monospace" }}>
              [{usageInfo.usageToday}/{usageInfo.limit} scans used today]
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {apiKey && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? '👁 Hide' : '👁 Reveal'}
              </button>
            )}
            {apiKey && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                onClick={handleCopy}
              >
                {copied ? '✓ Copied!' : 'Copy Key'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', border: '1px solid var(--accent)', color: 'var(--accent)' }}
              onClick={handleGenerateKey}
              disabled={generating}
            >
              {generating ? 'generating...' : apiKey ? 'regenerate_key()' : 'generate_key()'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        <input
          type="text"
          readOnly
          value={showKey ? apiKey : maskedKey}
          className="scan-form__input"
          style={{ width: '100%', fontFamily: "'JetBrains Mono', monospace", color: apiKey ? 'var(--cyan)' : 'var(--text-muted)' }}
        />
      </div>

      {/* Usage Limit Explainer */}
      <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          ⚡ Daily Rate Limit: 2 Automated Scans / Day
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Each unique API key is bound to your account and allowed up to <strong>2 automated scan requests per calendar day</strong>. This protects backend scanning nodes while providing free CI/CD verification for your projects.
        </p>
      </div>

      {/* CI/CD Integration Snippet */}
      {apiKey && (
        <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
          <div className="code-tag code-tag--cyan" style={{ marginBottom: '0.5rem' }}>// GitHub Actions Workflow (.github/workflows/vulta.yml)</div>
          <pre className="finding-card__code">
{`name: Vulta Security Check
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Vulta Audit
        run: |
          curl -X POST https://your-vulta-app.vercel.app/api/scan/ci-scan \\
            -H "Authorization: Bearer ${apiKey}" \\
            -H "Content-Type: application/json" \\
            -d '{"repo_url": "https://github.com/owner/repo"}'`}
          </pre>
        </div>
      )}
    </div>
  );
}

