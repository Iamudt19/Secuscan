import { useEffect, useRef } from 'react';

const CIRCUMFERENCE = 2 * Math.PI * 54; // r=54

const GRADE_COLORS = {
  'A+': '#00e87b',
  'A':  '#00e87b',
  'B':  '#5de4c7',
  'C':  '#e5c07b',
  'D':  '#e5934b',
  'F':  '#e5484d',
};

function getGradeColor(grade) {
  return GRADE_COLORS[grade] ?? '#8b9cc8';
}

export default function ScoreCard({ scan }) {
  const ringRef = useRef(null);
  const { score = 0, grade = '?', targetUrl, counts = {}, targetType, projectName } = scan;

  // Animate ring on mount
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const offset = CIRCUMFERENCE * (1 - score / 100);
    // Start from full (empty ring) and animate to score
    ring.style.strokeDashoffset = CIRCUMFERENCE;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = offset;
      });
    });
  }, [score]);

  const color = getGradeColor(grade);

  const countEntries = [
    { key: 'critical', label: 'Critical' },
    { key: 'high',     label: 'High' },
    { key: 'medium',   label: 'Medium' },
    { key: 'low',      label: 'Low' },
  ].filter((e) => counts[e.key] > 0);

  return (
    <div className="glass-card score-card">
      {/* Gauge */}
      <div className="score-gauge" role="img" aria-label={`Security score: ${score} out of 100`}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle className="score-gauge__bg" cx="70" cy="70" r="54" />
          <circle
            ref={ringRef}
            className="score-gauge__ring"
            cx="70" cy="70" r="54"
            stroke={color}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>
        <div className="score-gauge__label">
          <span className="score-gauge__number" style={{ color }}>
            {score}
          </span>
          <span className="score-gauge__grade">{grade}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="score-meta">
        {projectName && (
          <div className="text-muted text-sm mb-1">
            // project: {projectName}
          </div>
        )}
        <h2 className="score-meta__title">
          Security Score{' '}
          <span style={{ color, fontWeight: 800 }}>{grade}</span>
        </h2>
        <div className="score-meta__url">
          {targetType === 'repo' ? '[repo]' : '[web]'}{' '}
          <a href={targetUrl} target="_blank" rel="noopener noreferrer">
            {targetUrl}
          </a>
        </div>

        {/* Severity counts */}
        {countEntries.length > 0 ? (
          <div className="score-meta__counts">
            {countEntries.map(({ key, label }) => (
              <div key={key} className={`score-count score-count--${key}`}>
                <span className="score-count__dot" />
                {counts[key]} {label}
              </div>
            ))}
          </div>
        ) : (
          <div className="score-meta__counts">
            <div className="score-count" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
              ✅ No issues found — excellent security posture!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
