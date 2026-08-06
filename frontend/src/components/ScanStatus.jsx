import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

const WEBSITE_STEPS = [
  'Connecting to target server',
  'Checking security headers (CSP, HSTS...)',
  'Probing SSL/TLS certificate & protocols',
  'Probing exposed paths (.git, .env...)',
  'Compiling findings & scoring report',
];

const REPO_STEPS = [
  'Cloning repository (shallow depth)',
  'Analyzing committed file paths',
  'Scanning for hardcoded API keys & secrets',
  'Checking project dependencies for CVEs',
  'Compiling findings & scoring report',
];

export default function ScanStatus({ scanId, onComplete, onError }) {
  const [targetType, setTargetType] = useState('website');
  const [stepIndex, setStepIndex] = useState(0);
  const [dotCount, setDotCount]   = useState(0);

  const steps = targetType === 'repo' ? REPO_STEPS : WEBSITE_STEPS;

  // Cycle through friendly status messages
  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, 2800);
    return () => clearInterval(stepTimer);
  }, [steps.length]);

  // Animate dots
  useEffect(() => {
    const dotTimer = setInterval(() => setDotCount((d) => (d + 1) % 4), 500);
    return () => clearInterval(dotTimer);
  }, []);

  // Poll the API
  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/api/scan/${scanId}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.targetType) {
          setTargetType(data.targetType);
        }

        if (data.status === 'done') {
          onComplete(data);
          return; // stop polling
        }
        if (data.status === 'error') {
          onError(data.error || 'Scan failed. Please try again.');
          return;
        }
        // still pending/running — poll again in 2s
        setTimeout(poll, 2000);
      } catch (err) {
        if (!cancelled) onError('Lost connection to Vulta backend. Is it running?');
      }
    };

    // Initial poll after 1s delay
    const init = setTimeout(poll, 1000);
    return () => { cancelled = true; clearTimeout(init); };
  }, [scanId, onComplete, onError]);

  return (
    <div className="scan-status">
      <div className="scan-status__spinner" role="status" aria-label="Scanning" />
      <h2 className="scan-status__title gradient-text">Scanning in progress</h2>
      <p className="scan-status__step" style={{ minHeight: '1.5em' }}>
        {steps[stepIndex]}
        {'.'.repeat(dotCount)}
      </p>
      <p className="text-muted text-sm" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
        {targetType === 'repo'
          ? 'This can take up to 30 seconds for dependency analysis'
          : 'This typically takes 5–15 seconds'}
      </p>
    </div>
  );
}
