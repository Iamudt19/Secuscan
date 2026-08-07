import { useState, useEffect } from 'react';

export default function LandingPage({ onGetStarted }) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [typedText, setTypedText] = useState('');
  const fullText = 'vulta --scan https://yourapp.com';

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: '#030b07' }}>
      {/* Animated radial gradient following mouse */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(ellipse 60% 50% at ${mousePos.x}% ${mousePos.y}%, rgba(0,255,128,0.07) 0%, transparent 70%)`,
        transition: 'background 0.3s ease',
      }} />

      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `linear-gradient(rgba(0,255,128,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,128,0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Floating orbs */}
      <div style={{ position: 'fixed', top: '15%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,128,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0, animation: 'pulse 4s ease-in-out infinite' }} />
      <div style={{ position: 'fixed', bottom: '20%', left: '5%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,255,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0, animation: 'pulse 6s ease-in-out infinite 2s' }} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes scanLine { 0%{top:0} 100%{top:100%} }
        .land-btn-primary {
          background: linear-gradient(135deg, #00ff80, #00cc66);
          color: #030b07; border: none; padding: 0.9rem 2.2rem;
          border-radius: 8px; font-weight: 700; font-size: 1rem;
          cursor: pointer; transition: all 0.25s; letter-spacing: 0.02em;
          box-shadow: 0 0 30px rgba(0,255,128,0.3);
        }
        .land-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 50px rgba(0,255,128,0.5); }
        .land-btn-ghost {
          background: transparent; color: #00ff80;
          border: 1px solid rgba(0,255,128,0.35); padding: 0.9rem 2.2rem;
          border-radius: 8px; font-weight: 600; font-size: 1rem;
          cursor: pointer; transition: all 0.25s;
        }
        .land-btn-ghost:hover { background: rgba(0,255,128,0.08); border-color: #00ff80; }
        .feature-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(0,255,128,0.1);
          border-radius: 16px; padding: 2rem; transition: all 0.3s; position: relative; overflow: hidden;
        }
        .feature-card::before {
          content:''; position:absolute; inset:0; background: linear-gradient(135deg, rgba(0,255,128,0.05), transparent);
          opacity:0; transition:opacity 0.3s;
        }
        .feature-card:hover { border-color: rgba(0,255,128,0.35); transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,255,128,0.08); }
        .feature-card:hover::before { opacity:1; }
        .stat-pill {
          background: rgba(0,255,128,0.08); border: 1px solid rgba(0,255,128,0.2);
          border-radius: 100px; padding: 0.5rem 1.2rem; display: inline-flex;
          align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #00ff80;
        }
        .terminal-box {
          background: rgba(0,0,0,0.6); border: 1px solid rgba(0,255,128,0.2);
          border-radius: 12px; padding: 1.5rem 2rem; font-family: 'JetBrains Mono', monospace;
          font-size: 0.9rem; position: relative; overflow: hidden;
        }
        .terminal-box::before {
          content:''; position:absolute; left:0; right:0; height:2px;
          background: linear-gradient(90deg,transparent,#00ff80,transparent);
          animation: scanLine 3s linear infinite; opacity:0.4;
        }
      `}</style>

      {/* Minimal top bar */}
      <nav style={{ position: 'relative', zIndex: 10, padding: '1.5rem 3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#00ff80,#00cc66)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 900, color: '#030b07' }}>✦</div>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Vulta</span>
        </div>
        <button className="land-btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }} onClick={onGetStarted}>
          Sign In →
        </button>
      </nav>

      {/* Hero */}
      <div style={{ position: 'relative', zIndex: 5, maxWidth: 1100, margin: '0 auto', padding: '5rem 2rem 4rem', textAlign: 'center', animation: 'fadeUp 0.8s ease both' }}>
        {/* Badge */}
        <div className="stat-pill" style={{ marginBottom: '2rem', fontSize: '0.78rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Security-as-a-Service for developers
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(2.8rem, 6vw, 5.5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em', color: '#fff', marginBottom: '1.5rem' }}>
          Security checks<br />
          <span style={{ background: 'linear-gradient(135deg, #00ff80, #00e5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            indie hackers
          </span><br />
          deserve
        </h1>

        <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.55)', maxWidth: 580, margin: '0 auto 3rem', lineHeight: 1.7 }}>
          Instant, plain-English security analysis for your website or GitHub repo.
          No jargon. No bloat. Continuous line-by-line checks.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
          <button className="land-btn-primary" onClick={onGetStarted} id="hero-get-started">
            Get Started Free →
          </button>
          <button className="land-btn-ghost" onClick={onGetStarted}>
            View Demo
          </button>
        </div>

        {/* Terminal preview */}
        <div className="terminal-box" style={{ maxWidth: 600, margin: '0 auto 5rem', textAlign: 'left', animation: 'fadeUp 1s ease 0.3s both' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem', fontSize: '0.8rem' }}>$ </div>
          <div style={{ color: '#00ff80' }}>
            {typedText}
            <span style={{ animation: 'blink 1s infinite', borderRight: '2px solid #00ff80', marginLeft: 2 }}>&nbsp;</span>
          </div>
          <div style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
            <div>✦ Scanning headers... <span style={{ color: '#00ff80' }}>done</span></div>
            <div>✦ Checking SSL/TLS... <span style={{ color: '#00ff80' }}>done</span></div>
            <div>✦ Detecting exposed secrets... <span style={{ color: '#febc2e' }}>2 found</span></div>
            <div>✦ CVE database check... <span style={{ color: '#ff5f57' }}>3 critical</span></div>
          </div>
        </div>

        {/* Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '5rem' }}>
          {[
            { icon: '🔍', title: '<Scan/>', desc: 'Deep security analysis of websites & GitHub repos. Headers, SSL, secrets, CVEs — all covered.', color: '#00ff80' },
            { icon: '⚡', title: '<RedTeam/>', desc: 'AI-powered attack simulation. Find vulnerabilities before attackers do with real-world scenarios.', color: '#00e5ff' },
            { icon: '🐕', title: '<Watchdog/>', desc: 'Continuous monitoring with automated alerts. Get notified the moment something changes.', color: '#a78bfa' },
          ].map((f, i) => (
            <div key={i} className="feature-card" style={{ animation: `fadeUp 0.8s ease ${0.2 + i * 0.15}s both` }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: f.color, fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{f.title}</div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '5rem' }}>
          {[
            { n: '10k+', label: 'Scans Run' },
            { n: '99.9%', label: 'Uptime' },
            { n: '< 30s', label: 'Scan Time' },
            { n: 'Free', label: 'To Start' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#00ff80', letterSpacing: '-0.03em' }}>{s.n}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ background: 'linear-gradient(135deg, rgba(0,255,128,0.08), rgba(0,229,255,0.05))', border: '1px solid rgba(0,255,128,0.15)', borderRadius: 20, padding: '3rem 2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Ready to ship fearless?</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2rem' }}>Create your free account and run your first scan in 30 seconds.</p>
          <button className="land-btn-primary" onClick={onGetStarted} id="cta-get-started">
            Start Scanning Free →
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 5, textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        © 2025 Vulta · Scan. Fix. Ship Fearless.
      </footer>
    </div>
  );
}
