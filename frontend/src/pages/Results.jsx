import { useState, useCallback } from 'react';
import ScanStatus from '../components/ScanStatus';
import ScoreCard from '../components/ScoreCard';
import FindingsList from '../components/FindingsList';
import { API_BASE_URL } from '../config';

export default function Results({ scanId, targetUrl, onNewScan }) {
  const [scanData, setScanData]   = useState(null);
  const [error, setError]         = useState('');
  const [phase, setPhase]         = useState('loading'); // loading | done | error

  const handleComplete = useCallback((data) => {
    setScanData(data);
    setPhase('done');
  }, []);

  const handleError = useCallback((msg) => {
    setError(msg);
    setPhase('error');
  }, []);

  return (
    <div style={{ padding: '2rem 0 4rem' }}>
      <div className="container">
        {/* Back button */}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onNewScan}
          style={{ marginBottom: '2rem' }}
        >
          {'<- new_scan'}
        </button>

        {/* Loading state */}
        {phase === 'loading' && (
          <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <ScanStatus
              scanId={scanId}
              onComplete={handleComplete}
              onError={handleError}
            />
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <>
            <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
              <strong>Scan failed:</strong> {error}
            </div>
            <button type="button" className="btn btn-primary" onClick={onNewScan}>
              Try Again
            </button>
          </>
        )}

        {/* Results */}
        {phase === 'done' && scanData && (
          <>
            {/* Action Bar: AI Patch Generator & Badge */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <AiPatchButton scanId={scanId} />
              <BadgeEmbedButton scanId={scanId} />
            </div>

            {/* Score card */}
            <div style={{ marginBottom: '1.5rem' }}>
              <ScoreCard scan={scanData} />
            </div>

            {/* Disclaimer */}
            <div className="disclaimer-banner">
              {'/* authorized use only. scan targets you own. */'}
            </div>

            {/* Findings */}
            <FindingsList findings={scanData.findings} />
          </>
        )}
      </div>
    </div>
  );
}

function AiPatchButton({ scanId }) {
  const [loading, setLoading] = useState(false);
  const [patchData, setPatchData] = useState(null);
  const [open, setOpen] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scan/${scanId}/patch`, { method: 'POST' });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setPatchData(data.patch);
        setOpen(true);
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        style={{ fontSize: '0.8rem' }}
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? 'generating_ai_patch...' : '🤖 generate_ai_fix_patch()'}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: '700px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>✦ AI Fix Playbook (.patch)</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>✕ Close</button>
            </div>
            <pre className="finding-card__code" style={{ flex: 1, overflowY: 'auto', background: '#000', padding: '1rem', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
              {patchData}
            </pre>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigator.clipboard.writeText(patchData)}
              >
                Copy Patch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BadgeEmbedButton({ scanId }) {
  const [open, setOpen] = useState(false);
  const badgeUrl = `${API_BASE_URL}/api/badge/${scanId}`;
  const markdown = `[![Vulta Security](${badgeUrl})](https://iamudit02.vercel.app)`;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: '0.8rem' }}
        onClick={() => setOpen(true)}
      >
        🛡️ embed_security_badge()
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: '560px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--cyan)', fontSize: '1.1rem' }}>✦ Shareable Security Seal</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>✕ Close</button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem', background: '#000', padding: '1rem', borderRadius: 'var(--radius)' }}>
              <img src={badgeUrl} alt="Vulta Badge" style={{ height: '34px' }} />
            </div>
            <div className="scan-form__project" style={{ marginBottom: '1rem' }}>
              <label>// markdown_embed_code</label>
              <input type="text" readOnly value={markdown} className="scan-form__input" style={{ width: '100%', fontSize: '0.78rem' }} />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigator.clipboard.writeText(markdown)}
            >
              Copy Markdown Badge Code
            </button>
          </div>
        </div>
      )}
    </>
  );
}
