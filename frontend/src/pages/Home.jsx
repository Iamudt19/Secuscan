import { useEffect, useState } from 'react';
import ScanForm from '../components/ScanForm';
import { HumanSecurityHero, NodeTracerLine } from '../components/HumanIllustrations';
import { API_BASE_URL } from '../config';

function HistoryStrip({ onSelectScan }) {
  const [scans, setScans] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/history`)
      .then((r) => r.json())
      .then((d) => setScans(d.scans?.filter((s) => s.status === 'done') ?? []))
      .catch(() => {});
  }, []);

  if (scans.length === 0) return null;

  const GRADE_COLOR = { 'A+':'#00e87b', A:'#00e87b', B:'#5de4c7', C:'#e5c07b', D:'#e5934b', F:'#ff4d4d' };

  return (
    <div style={{ marginTop: '1rem' }}>
      <NodeTracerLine label="// recent_scans" />
      <div className="history-strip">
        {scans.slice(0, 6).map((s) => (
          <div
            key={s.id}
            className="history-item glass-card"
            onClick={() => onSelectScan(s.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectScan(s.id)}
          >
            <div className="history-item__url" title={s.targetUrl}>
              <span style={{ color: 'var(--accent)' }}>{s.targetType === 'repo' ? '<repo/> ' : '<web/> '}</span>
              {s.targetUrl.replace(/^https?:\/\//, '')}
            </div>
            <div className="history-item__meta">
              <span>{new Date(s.createdAt).toLocaleDateString()}</span>
              <span className="history-item__grade" style={{ color: GRADE_COLOR[s.grade] ?? 'var(--text-muted)' }}>
                {s.grade ?? '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home({ onScanStart, onSelectScan, prefillProjectName, prefillUrl, currentUser }) {
  const [activeFeature, setActiveFeature] = useState(null);

  const featureDetails = {
    'headers': 'Audits OWASP recommended security headers (HSTS, CSP, X-Frame-Options, Permissions-Policy)',
    'ssl/tls': 'Validates SSL certificate expiration, cipher suites, grade ratings, and HTTPS enforcement',
    'exposed_files': 'Detects publicly accessible .git, .env, backup archives, database dumps, and admin portals',
    'secrets': 'Scans repository commits for hardcoded API keys, JWT secrets, AWS tokens, and private keys',
    'cve_scan': 'Checks npm, PyPI, and package manifests against known CVE vulnerability databases',
  };

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="container--wide">
          <div className="hero__grid">
            {/* Left Content */}
            <div style={{ textAlign: 'left' }}>
              <div className="hero__eyebrow">
                ✦ // free_security_audit
              </div>
              <h1 className="hero__title">
                Security checks<br />
                <span className="gradient-text">indie hackers</span> deserve
              </h1>
              <p className="hero__subtitle">
                Instant, plain-English security analysis for your website or GitHub repo.
                No sign-up required, zero jargon, continuous line-by-line checks.
              </p>

              {/* Feature Pills (Image 2 style interactive tags) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                {[
                  'headers',
                  'ssl/tls',
                  'exposed_files',
                  'secrets',
                  'cve_scan',
                ].map((feat) => (
                  <span
                    key={feat}
                    className="tech-pill"
                    onMouseEnter={() => setActiveFeature(feat)}
                    onMouseLeave={() => setActiveFeature(null)}
                    style={{
                      borderColor: activeFeature === feat ? 'var(--accent)' : 'var(--border-panel)',
                      color: activeFeature === feat ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <span className="tech-pill__dot" />
                    &lt;{feat}/&gt;
                  </span>
                ))}
              </div>

              {/* Feature description tooltip */}
              {activeFeature && (
                <div style={{
                  fontSize: '0.78rem',
                  color: 'var(--cyan)',
                  background: 'rgba(93, 228, 199, 0.08)',
                  border: '1px solid rgba(93, 228, 199, 0.25)',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius)',
                  marginBottom: '1.5rem',
                  animation: 'fadeIn 0.2s ease',
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  ✦ <strong>&lt;{activeFeature}&gt;:</strong> {featureDetails[activeFeature]}
                </div>
              )}

              <ScanForm
                onScanStart={onScanStart}
                initialProjectName={prefillProjectName}
                initialUrl={prefillUrl}
                currentUser={currentUser}
              />

              {/* Demo target link */}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.9rem' }}>
                {'> try: '}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px'
                  }}
                  onClick={() => {
                    const el = document.getElementById('scan-url-input');
                    if (el) {
                      el.value = 'https://example.com';
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                >
                  https://example.com
                </button>
              </p>
            </div>

            {/* Right Vector Illustration (Image 1 + 2 Inspiration) */}
            <div>
              <HumanSecurityHero />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Divider */}
      <div className="container--wide">
        <NodeTracerLine label="// how_it_works" />
      </div>

      {/* How it works Cards */}
      <section style={{ padding: '1rem 0 2rem' }}>
        <div className="container--wide">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { step: '01', title: '<paste_url/>', desc: 'Any website URL or GitHub repository link', tag: '// input' },
              { step: '02', title: '<run_scan/>', desc: 'Executes 6+ security checks in under 5 seconds', tag: '// audit' },
              { step: '03', title: '<read_report/>', desc: 'Plain-English findings with clear severity tags', tag: '// output' },
              { step: '04', title: '<copy_fix/>', desc: 'Ready-to-use code snippets & Nginx/Apache configs', tag: '// resolve' },
            ].map((item) => (
              <div key={item.step} className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    //{item.step}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.tag}</span>
                </div>
                <h3 style={{ fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{item.title}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* History strip */}
      <section style={{ padding: '1rem 0 3rem' }}>
        <div className="container--wide">
          <HistoryStrip onSelectScan={onSelectScan} />
        </div>
      </section>
    </>
  );
}
