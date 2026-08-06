import { useState } from 'react';
import { API_BASE_URL } from '../config';
import { NodeTracerLine } from '../components/HumanIllustrations';

export default function AttackSurface() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [reconData, setReconData] = useState(null);
  const [error, setError] = useState('');

  const handleRecon = async (e) => {
    e.preventDefault();
    if (!domain) return;

    setLoading(true);
    setError('');
    setReconData(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/recon/subdomains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) throw new Error(data.error || 'Recon failed.');
      setReconData(data);
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
            ✦ // asset_reconnaissance_&amp;_subdomain_graph
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.25rem', marginBottom: '0.4rem' }}>
            &lt;attack_surface_recon/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '680px' }}>
            Discover exposed subdomains, active endpoints, and web infrastructure across your organization's domain ecosystem.
          </p>
        </div>

        {/* Recon Input Form */}
        <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
          <form onSubmit={handleRecon} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                className="scan-form__input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. example.com"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '160px', justifyContent: 'center' }}>
              {loading ? 'probing_nodes...' : 'launch_recon()'}
            </button>
          </form>
          {error && <div className="error-banner" style={{ marginTop: '1rem' }}>{error}</div>}
        </div>

        {/* Active Recon Visualization */}
        {reconData && (
          <div>
            <NodeTracerLine label={`// recon_results.${reconData.domain}`} />

            {/* Summary Badge Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TARGET DOMAIN</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cyan)', marginTop: '0.2rem' }}>{reconData.domain}</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTIVE SUBDOMAINS</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)' }}>{reconData.activeCount} / {reconData.totalProbed}</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EXPOSURE SCORE</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: reconData.activeCount > 3 ? 'var(--sev-high)' : 'var(--accent)' }}>
                  {reconData.activeCount > 3 ? 'MODERATE' : 'LOW'}
                </div>
              </div>
            </div>

            {/* Subdomain Nodes Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {reconData.subdomains.map((sub, i) => (
                <div
                  key={i}
                  className="glass-card"
                  style={{
                    padding: '1.25rem',
                    borderColor: sub.active ? 'rgba(0, 242, 254, 0.3)' : 'var(--border-panel)',
                    opacity: sub.active ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className={`badge ${sub.active ? 'badge-low' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>
                      {sub.active ? `ACTIVE HTTP ${sub.status}` : 'UNREACHABLE'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {sub.prefix}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', wordBreak: 'break-all' }}>
                    {sub.subdomain}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Header Server: <span style={{ color: 'var(--cyan)' }}>{sub.server}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
