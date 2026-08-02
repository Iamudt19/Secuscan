import { useState, useCallback } from 'react';
import ScanStatus from '../components/ScanStatus';
import ScoreCard from '../components/ScoreCard';
import FindingsList from '../components/FindingsList';

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
