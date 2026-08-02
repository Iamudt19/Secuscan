import { useState } from 'react';

const SEVERITY_ICONS = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
};

const SEVERITY_FRAMING = {
  critical: 'This is actively exploitable right now and should be fixed today.',
  high:     'Serious security vulnerability. Fix as soon as possible.',
  medium:   'Fix in the next development cycle.',
  low:      'Worth fixing, but not something an attacker is likely to find easily.',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      type="button"
      className={`finding-card__copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      aria-label="Copy fix to clipboard"
    >
      {copied ? '✓ Copied!' : 'Copy fix'}
    </button>
  );
}

export default function FindingCard({ finding, index }) {
  const [open, setOpen] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const { severity, title, summary, impact, fix, category, sourceTool, technicalDetails } = finding;

  const sevLower = severity?.toLowerCase() || 'low';

  // Parse technical details if present
  let techObj = null;
  if (technicalDetails) {
    try {
      techObj = JSON.parse(technicalDetails);
    } catch {
      techObj = null;
    }
  }

  return (
    <div
      className={`finding-card finding-card--${sevLower}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header row — click to expand */}
      <div
        className="finding-card__header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}
      >
        <span className={`badge badge-${sevLower}`}>
          {SEVERITY_ICONS[sevLower]} {severity}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="finding-card__title">{title}</div>
          {!open && (
            <div className="finding-card__summary">{summary}</div>
          )}
        </div>

        {/* Category chip */}
        <span style={{
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.06)',
          padding: '0.2rem 0.6rem',
          borderRadius: '999px',
          border: '1px solid var(--border-subtle)',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          marginLeft: '0.5rem',
          marginRight: '0.5rem',
        }} className="category-chip">
          {category === 'secrets' && 'secrets'}
          {category === 'dependencies' && 'dependencies'}
          {category === 'headers' && 'headers'}
          {category === 'ssl' && 'ssl/tls'}
          {category === 'exposed_files' && 'exposed_files'}
          {category === 'config' && 'config'}
          {!['secrets', 'dependencies', 'headers', 'ssl', 'exposed_files', 'config'].includes(category) && category}
        </span>

        <svg
          className={`finding-card__chevron ${open ? 'open' : ''}`}
          width="18" height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded body */}
      <div
        className="finding-card__body"
        style={{ maxHeight: open ? '1800px' : '0', transition: 'max-height 0.4s ease-in-out', overflow: 'hidden' }}
        aria-hidden={!open}
      >
        <div className="finding-card__body-inner" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Severity Translation Line */}
          <div style={{
            fontSize: '0.85rem',
            padding: '0.5rem 0.75rem',
            background: 'rgba(255,255,255,0.03)',
            borderLeft: `3px solid var(--severity-${sevLower})`,
            color: 'var(--text-secondary)',
            borderRadius: '0 4px 4px 0',
            fontStyle: 'italic'
          }}>
            <strong>{SEVERITY_ICONS[sevLower]} {severity.toUpperCase()}:</strong> {SEVERITY_FRAMING[sevLower]}
          </div>

          {/* What it means */}
          <div>
            <div className="finding-card__section-label">What this means</div>
            <p className="finding-card__text">{summary}</p>
          </div>

          {/* Real-world impact */}
          <div>
            <div className="finding-card__section-label">Real-world impact</div>
            <div className="finding-card__impact">
              <p className="finding-card__text" style={{ color: '#fdba74' }}>
                {impact}
              </p>
            </div>
          </div>

          {/* Fix */}
          <div>
            <div className="finding-card__fix-header">
              <div className="finding-card__section-label" style={{ marginBottom: 0 }}>
                How to fix it
              </div>
              <CopyButton text={fix} />
            </div>
            <pre className="finding-card__code">{fix}</pre>
          </div>

          {/* Technical Details Toggle */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowTech(!showTech); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: 0
              }}
            >
              <span>{showTech ? '▼' : '▶'} Technical Details</span>
              <code style={{ fontSize: '0.7rem', opacity: 0.6 }}>({sourceTool})</code>
            </button>

            {showTech && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'var(--text-muted)'
              }}>
                <div style={{ marginBottom: '0.25rem' }}><strong>Source Tool:</strong> {sourceTool}</div>
                {techObj && (
                  <>
                    <div style={{ marginBottom: '0.25rem' }}><strong>Detector Rule ID:</strong> {techObj.title}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}><strong>Raw Output Context:</strong> {techObj.original_summary}</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
