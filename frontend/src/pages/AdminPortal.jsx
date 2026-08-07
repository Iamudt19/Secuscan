import { useState } from 'react';
import { API_BASE_URL } from '../config';
import { NodeTracerLine } from '../components/HumanIllustrations';

// ─── Frontend-only password gate ("isha") ─────────────────────────────────────
const ADMIN_PASS = 'isha';

export default function AdminPortal() {
  const [frontPass, setFrontPass] = useState('');
  const [frontUnlocked, setFrontUnlocked] = useState(
    () => sessionStorage.getItem('vulta_admin_front') === '1'
  );
  const [frontError, setFrontError] = useState('');

  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('vulta_admin_token') || '');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: '' });

  // ── Front-door check ────────────────────────────────────────────────────────
  if (!frontUnlocked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#030b07', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'fixed', inset: 0,
          backgroundImage: 'linear-gradient(rgba(0,255,128,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,128,0.03) 1px,transparent 1px)',
          backgroundSize: '40px 40px', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,128,0.15)',
          borderRadius: 16, padding: '3rem 2.5rem', width: '100%', maxWidth: 400, textAlign: 'center',
          boxShadow: '0 20px 80px rgba(0,255,128,0.06)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔐</div>
          <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            &lt;admin_portal/&gt;
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '2rem' }}>
            Restricted access. Enter the admin password.
          </p>
          {frontError && (
            <div style={{
              background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)',
              borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem',
              color: '#ff6b6b', fontSize: '0.85rem'
            }}>{frontError}</div>
          )}
          <form onSubmit={(e) => {
            e.preventDefault();
            if (frontPass === ADMIN_PASS) {
              sessionStorage.setItem('vulta_admin_front', '1');
              setFrontUnlocked(true);
              setFrontError('');
            } else {
              setFrontError('Incorrect password. Access denied.');
              setFrontPass('');
            }
          }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              value={frontPass}
              onChange={(e) => setFrontPass(e.target.value)}
              placeholder="Enter password"
              autoFocus
              style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,128,0.2)',
                borderRadius: 8, padding: '0.8rem 1rem', color: '#fff',
                fontSize: '1rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                fontFamily: "'JetBrains Mono', monospace", textAlign: 'center', letterSpacing: '0.2em'
              }}
            />
            <button type="submit" style={{
              background: 'linear-gradient(135deg,#00ff80,#00cc66)',
              color: '#030b07', border: 'none', borderRadius: 8,
              padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              boxShadow: '0 0 30px rgba(0,255,128,0.25)'
            }}>
              unlock_portal()
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      setStatus({ loading: false, error: res.ok ? '' : (data.error || 'Login failed') });

      if (res.ok) {
        setAdminToken(data.adminToken);
        localStorage.setItem('vulta_admin_token', data.adminToken);
        fetchDashboardData(data.adminToken);
      }
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  const fetchDashboardData = async (token) => {
    const activeToken = token || adminToken;
    if (!activeToken) return;

    try {
      const [msgRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/messages`, { headers: { 'x-admin-token': activeToken } }),
        fetch(`${API_BASE_URL}/api/admin/stats`, { headers: { 'x-admin-token': activeToken } }),
      ]);

      if (msgRes.ok) {
        const msgData = await msgRes.json();
        setMessages(msgData.messages || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || null);
      }
    } catch (err) {
      console.error('[Admin Fetch Error]', err);
    }
  };

  const handleDeleteMessage = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/messages/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken },
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {}
  };

  const handleLogout = () => {
    setAdminToken('');
    localStorage.removeItem('vulta_admin_token');
  };

  if (!adminToken) {
    return (
      <div style={{ minHeight: '100vh', background: '#030b07', padding: '4rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-card" style={{ padding: '2.5rem 2rem', width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗝️</div>
          <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            &lt;admin_login/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Enter your backend admin token to access contact messages and platform telemetry.
          </p>

          {status.error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{status.error}</div>}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="scan-form__project">
              <label htmlFor="admin-pass">// admin_token</label>
              <input
                id="admin-pass"
                type="password"
                className="scan-form__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={status.loading}>
              {status.loading ? 'verifying...' : 'access_portal()'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        
        {/* Admin Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
              ✦ // superuser_control_plane
            </div>
            <h1 className="gradient-text" style={{ fontSize: '2rem' }}>
              &lt;admin_dashboard/&gt;
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => fetchDashboardData()}>
              ↻ Refresh Telemetry
            </button>
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--sev-critical)' }} onClick={handleLogout}>
              exit_admin()
            </button>
          </div>
        </div>

        {/* Telemetry Stats Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL USERS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--cyan)' }}>{stats.users}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL SCANS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)' }}>{stats.scans}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTIVE PROJECTS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--cyan)' }}>{stats.projects}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FINDINGS DETECTED</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--sev-high)' }}>{stats.findings}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INBOUND MESSAGES</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)' }}>{stats.messages}</div>
            </div>
          </div>
        )}

        <NodeTracerLine label="// contact_messages_database" />

        {/* Contact Messages Table */}
        <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent)' }}>
            ✦ Submitted Inbound Contact Messages ({messages.length})
          </h2>

          {!messages.length ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No messages submitted yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {messages.map((m) => (
                <div key={m.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-panel)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: '0.95rem' }}>{m.subject}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        From: <strong>{m.name}</strong> (&lt;{m.email}&gt;)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--sev-critical)' }}
                        onClick={() => handleDeleteMessage(m.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace" }}>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
