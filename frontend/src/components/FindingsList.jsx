import FindingCard from './FindingCard';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

const SEVERITY_LABELS = {
  critical: { label: 'Critical',  icon: '🔴', desc: 'Immediate action required' },
  high:     { label: 'High',      icon: '🟠', desc: 'Fix as soon as possible' },
  medium:   { label: 'Medium',    icon: '🟡', desc: 'Fix in the next sprint' },
  low:      { label: 'Low',       icon: '🔵', desc: 'Good-to-fix improvements' },
};

export default function FindingsList({ findings }) {
  if (!findings || findings.length === 0) {
    return (
      <div className="empty-state glass-card" style={{ padding: '3rem' }}>
        <div className="empty-state__icon">[ok]</div>
        <h3 style={{ marginBottom: '0.5rem' }}>No issues detected</h3>
        <p className="text-muted text-sm">
          Everything checked out clean. Keep up the great security hygiene!
        </p>
      </div>
    );
  }

  // Group findings by severity
  const grouped = {};
  for (const sev of SEVERITY_ORDER) {
    const group = findings.filter((f) => f.severity?.toLowerCase() === sev);
    if (group.length > 0) grouped[sev] = group;
  }

  let cardIndex = 0;

  return (
    <div className="findings-section">
      {Object.entries(grouped).map(([sev, items]) => {
        const meta = SEVERITY_LABELS[sev];
        return (
          <div key={sev} className="findings-group">
            <div className="findings-group__header">
              <span className={`badge badge-${sev}`}>
                {meta.icon} {meta.label}
              </span>
              <span className="findings-group__title">{meta.desc}</span>
              <span className="findings-group__count">{items.length} finding{items.length !== 1 ? 's' : ''}</span>
            </div>

            {items.map((finding) => {
              const idx = cardIndex++;
              return (
                <FindingCard key={finding.id} finding={finding} index={idx} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
