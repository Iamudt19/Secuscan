import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { NodeTracerLine } from '../components/HumanIllustrations';

export default function Watchdog({ currentUser, onNavigateToAuth }) {
  const [watchdogs, setWatchdogs] = useState([]);
  const [targetUrl, setTargetUrl] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchWatchdogs();
    }
  }, [currentUser]);

  const fetchWatchdogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchdogs`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setWatchdogs(data.watchdogs || []);
    } catch {}
  };

  const handleCreateWatchdog = async (e) => {
    e.preventDefault();
    if (!targetUrl) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/watchdogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target_url: targetUrl, frequency }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) throw new Error(data.error || 'Failed to create watchdog.');
      setTargetUrl('');
      fetchWatchdogs();
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '2.5rem', maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔔</div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Automated Watchdog Monitors</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            Schedule continuous background security audits for your websites and repositories. Log in to configure active monitors.
          </p>
          <button type="button" className="btn btn-primary" onClick={onNavigateToAuth}>
            &lt;sign_in_to_enable_watchdogs/&gt;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
            ✦ // background_audit_watchdogs
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.25rem', marginBottom: '0.4rem' }}>
            &lt;continuous_watchdog/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '680px' }}>
            Schedule automatic weekly security scans for your domains. Receive alerts if security headers change or certificates expire.
          </p>
        </div>

        {/* Create Watchdog Form */}
        <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'var(--accent)', marginBottom: '1rem' }}>
            + Create New Watchdog Monitor
          </h3>

          {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleCreateWatchdog} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '260px' }}>
              <input
                type="text"
                className="scan-form__input"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                required
              />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <select
                className="scan-form__input"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Daily Audit</option>
                <option value="weekly">Weekly Audit</option>
                <option value="monthly">Monthly Audit</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'saving...' : 'enable_monitor()'}
            </button>
          </form>
        </div>

        <NodeTracerLine label="// active_watchdogs" />

        {/* Watchdogs List */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {!watchdogs.length ? (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No active watchdogs configured. Create one above to enable automated background monitoring.
            </div>
          ) : (
            watchdogs.map((w) => (
              <div key={w.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span className="badge badge-low" style={{ marginRight: '0.6rem' }}>ACTIVE WATCHDOG</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--cyan)' }}>{w.target_url}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Frequency: {w.frequency} • Created: {new Date(w.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                  ✓ Health Monitoring Active
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
