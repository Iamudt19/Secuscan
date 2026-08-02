import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import ScoreCard from '../components/ScoreCard';
import FindingsList from '../components/FindingsList';

// SVG Sparkline Component
function Sparkline({ data, color = '#00e87b' }) {
  if (!data || data.length < 2) {
    return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{'// trend: pending (needs 2+ scans)'}</span>;
  }

  // Width is 140, Height is 40
  const points = data.map((d, index) => {
    const x = (index / (data.length - 1)) * 130 + 5;
    const y = 35 - (d.score / 100) * 30; // Scale 0-100 to height bounds
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Trend:</span>
      <svg width="140" height="40" style={{ overflow: 'visible' }}>
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={p.y < 20 ? '#00e87b' : '#e5c07b'} stroke="var(--bg-surface)" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
}

export default function ProjectDetail({ projectId, onBack, onScanTarget }) {
  const [projectData, setProjectData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [selectedScanData, setSelectedScanData] = useState(null);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [showCiSetup, setShowCiSetup] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fetchProjectDetails = () => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProjectData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch project details.');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  // Load selected historical scan findings when clicked
  useEffect(() => {
    if (!selectedScanId) {
      setSelectedScanData(null);
      return;
    }

    setIsLoadingScan(true);
    fetch(`${API_BASE_URL}/api/scan/${selectedScanId}`)
      .then((r) => r.json())
      .then((data) => {
        setSelectedScanData(data);
        setIsLoadingScan(false);
      })
      .catch(() => {
        setIsLoadingScan(false);
      });
  }, [selectedScanId]);

  const handleRegenerateToken = async () => {
    if (!window.confirm('Are you sure you want to regenerate the API token? The old token will immediately cease to work in CI pipelines.')) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/regenerate-token`, {
        method: 'POST'
      });
      const data = await res.json();
      setIsRegenerating(false);
      if (data.apiToken) {
        setProjectData((prev) => ({
          ...prev,
          project: {
            ...prev.project,
            apiToken: data.apiToken
          }
        }));
      }
    } catch {
      setIsRegenerating(false);
    }
  };

  const copyTokenToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(project.apiToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {}
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem' }}>
        <span className="scan-status__spinner" style={{ margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>loading_project...</p>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="error-banner">{'error: '}{error || 'project not found.'}</div>
        <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginTop: '1rem' }}>{'<- dashboard'}</button>
      </div>
    );
  }

  const { project, scoreInfo, history } = projectData;

  const repoHistory = [...history].filter((s) => s.targetType === 'repo' && s.status === 'done').reverse();
  const siteHistory = [...history].filter((s) => s.targetType === 'website' && s.status === 'done').reverse();

  const combinedColor = scoreInfo.combinedScore >= 80 ? 'var(--accent)' : scoreInfo.combinedScore >= 60 ? 'var(--cyan)' : 'var(--sev-critical)';

  const ciWorkflowYaml = `name: SecuScan CI Auditor

on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Trigger SecuScan Security Check
        run: |
          curl -X POST "https://your-secuscan-app.vercel.app/api/scan/ci-scan" \\
            -H "Authorization: Bearer \${{ secrets.SECUSCAN_PROJECT_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{"repo_url": "\${{ github.event.repository.html_url }}", "commit_sha": "\${{ github.sha }}", "project_id": "${project.id}"}'`;

  return (
    <div style={{ padding: '2rem 0 5rem' }}>
      <div className="container--wide">
        
        {/* Navigation panel */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            {'<- dashboard'}
          </button>
          
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCiSetup(!showCiSetup)}
            style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
          >
            {showCiSetup ? 'close_setup()' : 'setup_ci()'}
          </button>
        </div>

        {/* Part A CI setup instructions */}
        {showCiSetup && (
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }} className="gradient-text">
              // ci_setup
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Add a GitHub Actions workflow to run code scanning (secrets, configs, dependencies) automatically on every push or Pull Request.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Step 1 & 2 */}
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>1. Add Project Token to GitHub Secrets</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Go to your repository settings page: **Settings &gt; Secrets and variables &gt; Actions &gt; New repository secret**.
                </p>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Secret Name</div>
                    <code style={{ fontSize: '0.85rem', color: 'var(--text-code)', fontWeight: 'bold' }}>SECUSCAN_PROJECT_TOKEN</code>
                  </div>
                  <div style={{ flex: 1.5, minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Secret Value</div>
                    <code style={{ fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textDisplay: 'ellipsis', display: 'block' }}>
                      {project.apiToken || 'None generated'}
                    </code>
                  </div>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.35rem' }} onClick={copyTokenToClipboard}>
                    {copiedToken ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  onClick={handleRegenerateToken}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? 'Regenerating…' : '🔄 Regenerate Token'}
                </button>
              </div>

              {/* Step 3 */}
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>2. Add GitHub Action Workflow</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Create a file named `.github/workflows/secuscan.yml` in your repo and paste the configuration below:
                </p>
                <pre style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  color: '#e2e8f0',
                  lineHeight: '1.4'
                }}>
                  {ciWorkflowYaml}
                </pre>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Project Monitor</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }} className="gradient-text">{project.name}</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Monitored since {new Date(project.createdAt).toLocaleDateString()}</p>
          </div>

          {/* Combined Score Card */}
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.75rem', minWidth: '240px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.02)',
              border: `3px solid ${combinedColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.25rem',
              color: combinedColor
            }}>
              {scoreInfo.combinedScore !== null ? scoreInfo.combinedScore : '—'}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Combined Security Score</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {scoreInfo.combinedScore !== null ? `Security Rating: ${scoreInfo.combinedScore}/100` : 'No scans completed'}
              </div>
            </div>
          </div>
        </div>

        {/* Gap Insight Callout */}
        {scoreInfo.insight && (
          <div className="info-banner" style={{
            margin: '0 0 2rem 0',
            textAlign: 'left',
            padding: '1.25rem 1.5rem',
            borderLeft: '2px solid var(--cyan)',
            background: 'rgba(93, 228, 199, 0.04)'
          }}>
            <h4 style={{ color: 'var(--cyan)', marginBottom: '0.2rem', fontSize: '0.85rem' }}>// security_insight</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{scoreInfo.insight.text}</p>
          </div>
        )}

        {/* Side-by-Side Target Posture Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          
          {/* Repo Card */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '320px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.2rem' }}>[repo] security</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: {scoreInfo.latestRepo ? scoreInfo.latestRepo.targetUrl.replace(/^https?:\/\//, '') : 'None linked'}</span>
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  color: scoreInfo.latestRepo ? (scoreInfo.latestRepo.score >= 80 ? 'var(--accent)' : scoreInfo.latestRepo.score >= 60 ? 'var(--cyan)' : 'var(--sev-critical)') : 'var(--text-muted)'
                }}>
                  {scoreInfo.latestRepo ? `${scoreInfo.latestRepo.score}%` : '—'}
                </div>
              </div>

              {scoreInfo.latestRepo ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Verifies hardcoded secrets (gitleaks), vulnerable dependencies (cve audits), and exposed deployment files.
                  </p>
                  <Sparkline data={repoHistory} color="var(--pink)" />
                </div>
              ) : (
                <div style={{ margin: '1.5rem 0', padding: '0.85rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{'// no repo scanned yet'}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onScanTarget('repo', project.name, scoreInfo.latestRepo?.targetUrl || '')}
              style={{ width: '100%' }}
            >
              {scoreInfo.latestRepo ? 'rescan_repo()' : 'link_repo()'}
            </button>
          </div>

          {/* Website Card */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '320px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.2rem' }}>[web] deployed_site</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: {scoreInfo.latestSite ? scoreInfo.latestSite.targetUrl.replace(/^https?:\/\//, '') : 'None linked'}</span>
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  color: scoreInfo.latestSite ? (scoreInfo.latestSite.score >= 80 ? 'var(--accent)' : scoreInfo.latestSite.score >= 60 ? 'var(--cyan)' : 'var(--sev-critical)') : 'var(--text-muted)'
                }}>
                  {scoreInfo.latestSite ? `${scoreInfo.latestSite.score}%` : '—'}
                </div>
              </div>

              {scoreInfo.latestSite ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Checks live server SSL/TLS config, security headers (CSP, HSTS), and exposed path probes.
                  </p>
                  <Sparkline data={siteHistory} color="var(--cyan)" />
                </div>
              ) : (
                <div style={{ margin: '1.5rem 0', padding: '0.85rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{'// no website scanned yet'}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onScanTarget('website', project.name, scoreInfo.latestSite?.targetUrl || '')}
              style={{ width: '100%' }}
            >
              {scoreInfo.latestSite ? 'rescan_site()' : 'link_site()'}
            </button>
          </div>

        </div>

        {/* Scan History list */}
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem' }}>// scan_history</h2>
          
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{'// no scans recorded'}</p>
          ) : (
            <div className="glass-card" style={{ padding: '0.5rem 0', overflow: 'hidden' }}>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '1rem 1.5rem' }}>Type</th>
                      <th style={{ padding: '1rem' }}>Target</th>
                      <th style={{ padding: '1rem' }}>Score</th>
                      <th style={{ padding: '1rem' }}>Date</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((s) => (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: selectedScanId === s.id ? 'rgba(255,255,255,0.02)' : 'transparent'
                        }}
                        onClick={() => setSelectedScanId(selectedScanId === s.id ? null : s.id)}
                      >
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>
                          {s.targetType === 'repo' ? '[repo]' : '[web]'}
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.targetUrl}>
                          {s.targetUrl}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 700 }}>
                          {s.status === 'done' ? (
                            <span style={{
                              color: s.score >= 80 ? 'var(--accent)' : s.score >= 60 ? 'var(--cyan)' : 'var(--sev-critical)'
                            }}>
                              {s.score}% ({s.grade})
                            </span>
                          ) : s.status === 'error' ? (
                            <span style={{ color: 'var(--sev-critical)' }}>Error</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Running…</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                          {new Date(s.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: 'var(--accent)' }}>
                          {selectedScanId === s.id ? 'collapse ^' : 'expand v'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Selected Historical Scan Findings (inline preview) */}
        {selectedScanId && (
          <div className="glass-card" style={{ marginTop: '2rem', padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Historical Scan Report Preview</h3>
                {selectedScanData && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scan ID: {selectedScanId} | Score: {selectedScanData.score}%</p>}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setSelectedScanId(null)}
              >
                Close Preview ×
              </button>
            </div>

            {isLoadingScan ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <span className="scan-status__spinner" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading scan history details…</p>
              </div>
            ) : selectedScanData ? (
              <>
                <ScoreCard scan={selectedScanData} />
                <div style={{ margin: '1.5rem 0' }}>
                  <FindingsList findings={selectedScanData.findings} />
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--sev-critical)' }}>Failed to load scan report details.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
