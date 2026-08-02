import { useState } from 'react';
import { NodeTracerLine } from '../components/HumanIllustrations';

export default function Benchmark() {
  const [items, setItems] = useState({
    hsts: true,
    csp: false,
    sslTls13: true,
    noGitExposed: true,
    noHardcodedKeys: false,
    cveDependencies: true,
    rateLimiting: false,
    securityTxt: true,
  });

  const toggleItem = (key) => {
    setItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const total = Object.keys(items).length;
  const passed = Object.values(items).filter(Boolean).length;
  const score = Math.round((passed / total) * 100);

  let grade = 'F';
  let gradeColor = '#ff4d4d';
  if (score >= 90) { grade = 'A+'; gradeColor = '#00e87b'; }
  else if (score >= 80) { grade = 'A'; gradeColor = '#00e87b'; }
  else if (score >= 70) { grade = 'B'; gradeColor = '#5de4c7'; }
  else if (score >= 60) { grade = 'C'; gradeColor = '#ffd166'; }
  else if (score >= 50) { grade = 'D'; gradeColor = '#ff944d'; }

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        {/* Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
            ✦ // compliance_calculator &amp; standards
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>
            &lt;security_benchmarks/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '680px' }}>
            Calculate compliance readiness against PCI-DSS 4.0, SOC 2 Type II, and OWASP Application Security Verification Standards (ASVS).
          </p>
        </div>

        <NodeTracerLine label="// compliance_score_calculator" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          {/* Top Score Gauge Banner */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <span className="code-tag code-tag--accent" style={{ display: 'block', marginBottom: '0.3rem' }}>// compliance_readiness</span>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                Score: <span style={{ color: gradeColor }}>{score}% ({grade})</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Passed {passed} of {total} benchmark security controls
              </p>
            </div>

            {/* Compliance Badges */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span className={`badge ${score >= 75 ? 'badge-low' : 'badge-technical'}`}>
                SOC 2: {score >= 75 ? 'READY' : 'GAPS'}
              </span>
              <span className={`badge ${score >= 80 ? 'badge-low' : 'badge-technical'}`}>
                PCI-DSS 4.0: {score >= 80 ? 'COMPLIANT' : 'NON-COMPLIANT'}
              </span>
              <span className={`badge ${score >= 70 ? 'badge-low' : 'badge-technical'}`}>
                OWASP ASVS: Level {score >= 85 ? '2' : '1'}
              </span>
            </div>
          </div>

          {/* Interactive Checklist */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--accent)' }}>
              ✦ Interactive Security Control Checklist
            </h3>

            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {[
                { key: 'hsts', title: 'HTTP Strict Transport Security (HSTS)', std: 'PCI-DSS 4.0 §4.1', desc: 'Enforces encrypted connections across all subdomains' },
                { key: 'csp', title: 'Content Security Policy (CSP)', std: 'OWASP ASVS §14.4', desc: 'Mitigates Cross-Site Scripting (XSS) and script injection' },
                { key: 'sslTls13', title: 'TLS 1.2+ Protocol Enforcement', std: 'SOC 2 CC6.6', desc: 'Disables insecure TLS 1.0/1.1 and weak ciphers' },
                { key: 'noGitExposed', title: 'No Exposed Version Control (.git)', std: 'OWASP Top 10 A05', desc: 'Prevents web root source code repository leakage' },
                { key: 'noHardcodedKeys', title: 'Automated Secret Scanning in CI/CD', std: 'SOC 2 CC6.1', desc: 'Ensures no AWS/API secrets enter Git history' },
                { key: 'cveDependencies', title: 'Zero Critical Vulnerabilities in Dependencies', std: 'PCI-DSS 4.0 §6.3', desc: 'Patches known CVEs in third-party packages' },
                { key: 'rateLimiting', title: 'API Rate Limiting & SSRF Guards', std: 'OWASP Top 10 A10', desc: 'Protects backend from Denial of Service and internal network probes' },
                { key: 'securityTxt', title: 'Vulnerability Disclosure Policy (security.txt)', std: 'ISO 27001 A.12.6', desc: 'Provides security researchers a contact method for responsible disclosure' },
              ].map((c) => (
                <div
                  key={c.key}
                  onClick={() => toggleItem(c.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-base)',
                    border: `1px solid ${items[c.key] ? 'var(--border)' : 'var(--border-subtle)'}`,
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={items[c.key]}
                      onChange={() => {}}
                      style={{ accentColor: 'var(--accent)', width: '18px', height: '18px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: items[c.key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {c.desc}
                      </div>
                    </div>
                  </div>

                  <span className="code-tag code-tag--accent" style={{ whiteSpace: 'nowrap' }}>
                    {c.std}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
