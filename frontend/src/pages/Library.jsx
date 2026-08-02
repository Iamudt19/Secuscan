import { useState } from 'react';
import { NodeTracerLine } from '../components/HumanIllustrations';

const DETECTOR_RULES = [
  {
    id: 'SEC-HDR-001',
    name: 'Missing Strict-Transport-Security (HSTS)',
    category: 'headers',
    severity: 'high',
    cve: 'CWE-523',
    summary: 'The website does not enforce HTTPS via HSTS headers, leaving users vulnerable to SSL stripping attacks.',
    impact: 'An attacker on public Wi-Fi can downgrade connections to unencrypted HTTP and capture passwords.',
    fix: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
  },
  {
    id: 'SEC-HDR-002',
    name: 'Missing Content-Security-Policy (CSP)',
    category: 'headers',
    severity: 'medium',
    cve: 'CWE-79',
    summary: 'No Content-Security-Policy header detected. Cross-Site Scripting (XSS) attacks are unmitigated.',
    impact: 'Attacker can inject malicious scripts to steal session cookies or log user keystrokes.',
    fix: 'add_header Content-Security-Policy "default-src \'self\';" always;'
  },
  {
    id: 'SEC-EXP-001',
    name: 'Publicly Accessible .git Repository',
    category: 'exposed_files',
    severity: 'critical',
    cve: 'CWE-538',
    summary: 'The .git folder is exposed over the web server, allowing anyone to download source code and history.',
    impact: 'Attackers can rebuild your entire application codebase, secret keys, and commit history.',
    fix: 'location ~ /\\.git { deny all; return 404; }'
  },
  {
    id: 'SEC-EXP-002',
    name: 'Exposed Environment File (.env)',
    category: 'exposed_files',
    severity: 'critical',
    cve: 'CWE-200',
    summary: 'Environment variable file (.env) is directly accessible at the web root.',
    impact: 'Immediate total compromise: Database passwords, API tokens, and secret keys exposed.',
    fix: 'location ~ /\\.env { deny all; return 404; }'
  },
  {
    id: 'SEC-KEY-001',
    name: 'Hardcoded AWS Access Key / Secret Key',
    category: 'secrets',
    severity: 'critical',
    cve: 'CWE-798',
    summary: 'AWS credential pattern detected inside source code repository.',
    impact: 'Attackers can take over your AWS cloud infrastructure, spawn crypto miners, or steal S3 data.',
    fix: 'Store keys in environment variables or AWS Secrets Manager. Revoke exposed AWS key in IAM immediately.'
  },
  {
    id: 'SEC-KEY-002',
    name: 'Hardcoded Private Key (RSA / SSH)',
    category: 'secrets',
    severity: 'critical',
    cve: 'CWE-321',
    summary: 'BEGIN PRIVATE KEY pattern found in repository files.',
    impact: 'Enables remote SSH server access or cryptographic signature forgery.',
    fix: 'Remove private keys from repository immediately and rotate keypairs on affected servers.'
  },
  {
    id: 'SEC-SSL-001',
    name: 'Expired or Invalid SSL/TLS Certificate',
    category: 'ssl',
    severity: 'critical',
    cve: 'CWE-295',
    summary: 'The SSL certificate for the target domain has expired or is self-signed.',
    impact: 'Browsers display security warnings blocking all users from accessing your application.',
    fix: 'Renew SSL certificate using Let\'s Encrypt (certbot renew) or your DNS provider.'
  },
  {
    id: 'SEC-DEP-001',
    name: 'Known Critical CVE in Package Dependencies',
    category: 'dependencies',
    severity: 'high',
    cve: 'CVE-2023-4863',
    summary: 'Third-party npm or PyPI dependency contains a known remote code execution (RCE) flaw.',
    impact: 'Remote attackers can execute arbitrary shell commands on your application server.',
    fix: 'Run `npm audit fix` or upgrade affected package to latest safe release version.'
  }
];

export default function Library() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredRules = DETECTOR_RULES.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
                          r.id.toLowerCase().includes(search.toLowerCase()) ||
                          r.summary.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || r.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        {/* Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
            ✦ // detector_rules &amp; threat_database
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>
            &lt;threat_library/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '680px' }}>
            Full index of automated security rules, vulnerability heuristics, attack vector descriptions, and remediation code snippets evaluated by SecuScan.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="scan-form__input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by rule ID, CVE, or keyword (e.g., .env, HSTS, XSS)..."
              style={{ flex: 1, minWidth: '260px' }}
            />
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['all', 'headers', 'exposed_files', 'secrets', 'ssl', 'dependencies'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem' }}
                >
                  {cat === 'all' ? 'all_rules' : `<${cat}/>`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <NodeTracerLine label={`// matching_rules (${filteredRules.length})`} />

        {/* Rules Grid */}
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {filteredRules.map((rule) => (
            <div key={rule.id} className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <span className={`badge badge-${rule.severity}`} style={{ marginRight: '0.6rem' }}>
                    {rule.severity.toUpperCase()}
                  </span>
                  <span className="code-tag code-tag--accent" style={{ marginRight: '0.6rem' }}>{rule.id}</span>
                  <span className="code-tag code-tag--cyan">[{rule.cve}]</span>
                  <h3 style={{ fontSize: '1.1rem', marginTop: '0.35rem', fontWeight: 700 }}>{rule.name}</h3>
                </div>
                <span className="tech-pill">&lt;{rule.category}/&gt;</span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {rule.summary}
              </p>

              <div style={{ background: 'rgba(255, 148, 77, 0.08)', borderLeft: '3px solid var(--sev-high)', padding: '0.6rem 0.85rem', borderRadius: '0 4px 4px 0', marginBottom: '1rem', fontSize: '0.82rem', color: '#ffb380' }}>
                <strong>Real-World Impact:</strong> {rule.impact}
              </div>

              <div>
                <span className="code-tag code-tag--accent" style={{ display: 'block', marginBottom: '0.3rem' }}>// recommended_fix</span>
                <pre className="finding-card__code" style={{ margin: 0, padding: '0.75rem' }}>{rule.fix}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
