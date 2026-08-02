import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { HumanEmptyState, NodeTracerLine } from '../components/HumanIllustrations';

export default function Dashboard({ onSelectProject, onScanProject }) {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchProjects = () => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/projects`)
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load projects. Is the backend running?');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const data = await res.json();
      setIsSubmitting(false);

      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      setNewProjectName('');
      fetchProjects();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
              ✦ // security_workspace
            </div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }} className="gradient-text">&lt;project_dashboard/&gt;</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Compare repository security posture and live deployment checks side-by-side.
            </p>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            count: {projects.length}
          </span>
        </div>

        <NodeTracerLine label="// manage_projects" />

        {/* Create Project Form */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2.5rem', maxWidth: '640px' }}>
          <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent)' }}>// create_new_project</h3>
          <form onSubmit={handleCreateProject} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              className="scan-form__input"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. My SaaS Product"
              disabled={isSubmitting}
              style={{ margin: 0, flex: 1 }}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !newProjectName.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isSubmitting ? 'creating...' : 'add_project()'}
            </button>
          </form>
          {error && <div className="error-banner" style={{ marginTop: '0.75rem' }}>{'error: '}{error}</div>}
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="scan-status__spinner" />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>loading_projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <HumanEmptyState
            title="<no_projects_created/>"
            description="Create a project above or run a scan from the home screen to track continuous security posture."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1.25rem' }}>
            {projects.map((p) => {
              const combinedScore = p.combinedScore;
              let scoreColor = '#4ea8de';
              if (combinedScore !== null) {
                if (combinedScore >= 80) scoreColor = '#00e87b';
                else if (combinedScore >= 60) scoreColor = '#ffd166';
                else scoreColor = '#ff4d4d';
              }

              return (
                <div
                  key={p.id}
                  className="glass-card project-card"
                  style={{
                    padding: '1.6rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '200px'
                  }}
                  onClick={() => onSelectProject(p.id)}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                      <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{p.name}</h3>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: 'var(--radius)',
                          background: 'var(--bg-base)',
                          border: `1.5px solid ${scoreColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: scoreColor,
                          boxShadow: `0 0 12px ${scoreColor}33`
                        }}
                      >
                        {combinedScore !== null ? combinedScore : '—'}
                      </div>
                    </div>

                    {/* Scan targets status */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                      <span className={`badge ${p.hasRepo ? 'badge-low' : 'badge-technical'}`} style={{ fontSize: '0.7rem' }}>
                        &lt;repo/&gt; {p.hasRepo ? `${p.latestRepoScore}%` : 'pending'}
                      </span>
                      <span className={`badge ${p.hasSite ? 'badge-low' : 'badge-technical'}`} style={{ fontSize: '0.7rem' }}>
                        &lt;web/&gt; {p.hasSite ? `${p.latestSiteScore}%` : 'pending'}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.85rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}>
                    <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.lastScanned ? `last: ${new Date(p.lastScanned).toLocaleDateString()}` : '// never scanned'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onScanProject(p.id, p.name);
                      }}
                    >
                      rescan()
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
