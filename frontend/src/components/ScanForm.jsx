import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const PLACEHOLDER = {
  website: 'https://example.com',
  repo: 'https://github.com/owner/repository',
};

export default function ScanForm({ onScanStart, initialUrl = '', initialProjectName = '', currentUser }) {
  const [url, setUrl] = useState(initialUrl);
  const [targetType, setTargetType] = useState('website');
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState(initialProjectName);
  const [projectsList, setProjectsList] = useState([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [error, setError] = useState('');

  // Fetch projects list on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/projects`)
      .then((r) => r.json())
      .then((data) => setProjectsList(data.projects || []))
      .catch(() => {});
  }, []);

  // Sync props when modified from parent (e.g. scan again clicks)
  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      if (initialUrl.includes('github.com')) {
        setTargetType('repo');
      } else {
        setTargetType('website');
      }
    }
    if (initialProjectName) {
      setProjectName(initialProjectName);
      setIsCreatingNew(true);
      setProjectId('new');
    }
  }, [initialUrl, initialProjectName]);

  // Auto-detect target type from URL
  const handleUrlChange = useCallback((e) => {
    const val = e.target.value;
    setUrl(val);
    setError('');
    if (val.includes('github.com')) {
      setTargetType('repo');
    } else if (val.startsWith('http')) {
      setTargetType('website');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) { setError('Please enter a URL.'); return; }

    setIsLoading(true);
    setError('');
    setIsWakingUp(false);

    // If request takes >2.5s, assume Render cold start/waking up
    const wakeTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 2500);

    const payload = {
      url: url.trim(),
    };

    if (projectId === 'new') {
      payload.project_name = projectName.trim() || undefined;
    } else if (projectId && projectId !== '') {
      payload.project_id = projectId;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.includes('DATABASE_URL') || !res.ok ? 'Database or backend environment error. Please check Vercel environment variables.' : 'Unexpected server response.');
      }

      clearTimeout(wakeTimer);
      setIsWakingUp(false);

      if (!res.ok) throw new Error(data.error || 'Failed to start scan');
      onScanStart(data.scanId, data.targetUrl);
    } catch (err) {
      clearTimeout(wakeTimer);
      setIsWakingUp(false);
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="glass-card scan-form">
        {/* Type Toggle */}
        <div className="scan-form__toggle">
          <button
            type="button"
            className={`scan-form__toggle-btn ${targetType === 'website' ? 'active' : ''}`}
            onClick={() => setTargetType('website')}
          >
            web
          </button>
          <button
            type="button"
            className={`scan-form__toggle-btn ${targetType === 'repo' ? 'active' : ''}`}
            onClick={() => setTargetType('repo')}
          >
            repo
          </button>
        </div>

        {/* URL Input */}
        <div className="scan-form__input-row">
          <input
            id="scan-url-input"
            type="url"
            className="scan-form__input"
            value={url}
            onChange={handleUrlChange}
            placeholder={PLACEHOLDER[targetType]}
            autoComplete="url"
            spellCheck="false"
            disabled={isLoading}
          />
          <button
            id="scan-submit-btn"
            type="submit"
            className={`btn btn-primary ${!isLoading && url ? 'btn-scan-pulse' : ''}`}
            disabled={isLoading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {isLoading ? (
              <>
                <span style={{display:'inline-block', width:14, height:14, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'var(--bg-base)', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginRight: '5px'}} />
                {isWakingUp ? 'waking_server...' : 'scanning...'}
              </>
            ) : (
              <>run_scan()</>  
            )}
          </button>
        </div>

        {/* Project Selector dropdown */}
        {currentUser ? (
          <>
            <div className="scan-form__project" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="project-select">// project (optional)</label>
              <select
                id="project-select"
                className="scan-form__input"
                value={projectId}
                onChange={(e) => {
                  const val = e.target.value;
                  setProjectId(val);
                  setIsCreatingNew(val === 'new');
                }}
                disabled={isLoading}
                style={{ maxWidth: 360, background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">-- No Project (Stand-alone scan) --</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="new">＋ Create New Project...</option>
              </select>
            </div>

            {/* Project Name Text Input (Visible only if Create New Project selected) */}
            {isCreatingNew && (
              <div className="scan-form__project" style={{ marginTop: '0.5rem', animation: 'fadeIn 0.25s ease' }}>
                <label htmlFor="project-name">// new_project_name</label>
                <input
                  id="project-name"
                  type="text"
                  className="scan-form__input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. My SaaS Dashboard"
                  disabled={isLoading}
                  style={{ maxWidth: 360 }}
                  required
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius)', border: '1px dashed var(--border-subtle)', marginTop: '0.5rem' }}>
            {'// sign in to save scan history to project dashboards'}
          </div>
        )}

        {/* Cold Start Notice */}
        {isWakingUp && (
          <div className="info-banner" style={{ marginTop: '0.6rem' }}>
            {'// cold_start: free-tier server waking up (30-60s). please wait.'}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner" role="alert" style={{ marginTop: '0.6rem' }}>
            {'error: '}{error}
          </div>
        )}

        {/* Disclaimer */}
        <p className="scan-form__disclaimer">
          {'/* authorized use only. scan targets you own. no raw data stored. */'}
        </p>
      </div>
    </form>
  );
}
