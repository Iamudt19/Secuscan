import React from 'react';

/**
 * HumanSecurityHero - A custom vector illustration component combining:
 * 1. Image 1 Inspiration: Continuous line-art human characters with keyholes, document papers, stippling, and sparkle stars (✦, ✧).
 * 2. Image 2 Inspiration: Cyberpunk glowing neon mint green node connectors, code tags, and tracer lines (•──────•).
 */
export function HumanSecurityHero() {
  return (
    <div className="human-hero-container">
      <svg
        viewBox="0 0 720 400"
        className="human-hero-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="mintGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e87b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#5de4c7" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 232, 123, 0.2)" />
            <stop offset="50%" stopColor="rgba(0, 232, 123, 0.8)" />
            <stop offset="100%" stopColor="rgba(93, 228, 199, 0.2)" />
          </linearGradient>
          <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#121822" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0a0e14" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="sparkleGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00e87b" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00e87b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background Grid Lines & Connecting Nodes (Image 2 style) */}
        <g stroke="rgba(0, 232, 123, 0.12)" strokeWidth="1" strokeDasharray="4 4">
          <line x1="40" y1="200" x2="680" y2="200" />
          <line x1="180" y1="40" x2="180" y2="360" />
          <line x1="540" y1="40" x2="540" y2="360" />
        </g>

        {/* Curved Glowing Tracer Line connecting components */}
        <path
          d="M 60 200 C 140 200, 160 80, 260 80 C 380 80, 420 320, 520 320 C 600 320, 640 200, 680 200"
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="8 4"
          className="animated-tracer"
        />

        {/* Node Points along the curve */}
        <circle cx="260" cy="80" r="4" fill="#00e87b" className="node-pulse" />
        <circle cx="520" cy="320" r="4" fill="#5de4c7" className="node-pulse" />

        {/* ─── HUMAN CHARACTER 1: Looking into Browser / Code Window (Image 1 style) ─── */}
        <g transform="translate(70, 50)" className="human-figure-1">
          {/* Continuous Line Art - Head & Hair */}
          <circle cx="90" cy="110" r="42" stroke="#e6edf3" strokeWidth="2.5" fill="#0d1117" />
          <circle cx="90" cy="110" r="4" fill="#00e87b" /> {/* Eye */}
          <circle cx="90" cy="54" r="14" fill="#e6edf3" /> {/* Hair bun */}
          
          {/* Nose line */}
          <path d="M 90 110 L 104 116" stroke="#e6edf3" strokeWidth="2.5" strokeLinecap="round" />

          {/* Body / Arms swooping into Code Window */}
          <path
            d="M 52 140 C 30 180, 30 220, 110 220 C 180 220, 200 180, 180 140 C 170 120, 140 120, 130 140"
            stroke="#e6edf3"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Stippled / Dotted Detail Patch (Image 1 texture) */}
          <pattern id="stipple" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#00e87b" opacity="0.6" />
          </pattern>
          <path
            d="M 60 170 C 80 170, 100 190, 100 215 C 75 215, 60 200, 60 170 Z"
            fill="url(#stipple)"
          />
        </g>

        {/* ─── CODE / SECURITY WINDOW WITH KEYHOLE (Image 1 & 2 hybrid) ─── */}
        <g transform="translate(380, 70)" className="hero-code-window">
          {/* Window Container */}
          <rect
            x="0"
            y="0"
            width="240"
            height="180"
            rx="8"
            fill="url(#panelGrad)"
            stroke="rgba(0, 232, 123, 0.3)"
            strokeWidth="1.5"
          />
          {/* Window Header Bar */}
          <rect x="0" y="0" width="240" height="30" rx="8" fill="#151b24" />
          <circle cx="16" cy="15" r="4" fill="#e5484d" />
          <circle cx="30" cy="15" r="4" fill="#e5c07b" />
          <circle cx="44" cy="15" r="4" fill="#00e87b" />
          <text x="64" y="19" fill="#9ba4af" fontSize="10" fontFamily="'JetBrains Mono', monospace">
            vulta_audit.sh
          </text>

          {/* Code Lines inside window */}
          <line x1="20" y1="50" x2="140" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinecap="round" />
          <line x1="20" y1="65" x2="100" y2="65" stroke="rgba(0, 232, 123, 0.7)" strokeWidth="3" strokeLinecap="round" />
          <line x1="20" y1="80" x2="160" y2="80" stroke="rgba(93, 228, 199, 0.5)" strokeWidth="3" strokeLinecap="round" />
          <line x1="20" y1="95" x2="80" y2="95" stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinecap="round" />

          {/* Keyhole Cutout Emblem (Image 1 feature) */}
          <g transform="translate(150, 100)">
            <circle cx="25" cy="20" r="16" fill="#0a0e14" stroke="#00e87b" strokeWidth="2" />
            <path d="M 25 12 A 7 7 0 1 0 25 24 L 29 36 L 21 36 Z" fill="#00e87b" />
          </g>
        </g>

        {/* ─── FLOATING SECURITY DOCUMENT PAPER (Image 1 style) ─── */}
        <g transform="translate(240, 30)" className="floating-paper">
          {/* Folded Document Paper */}
          <path
            d="M 0 0 L 70 0 L 100 30 L 100 130 L 0 130 Z"
            fill="#0f141d"
            stroke="#e6edf3"
            strokeWidth="2"
          />
          {/* Fold corner */}
          <path d="M 70 0 L 70 30 L 100 30" fill="none" stroke="#e6edf3" strokeWidth="2" />
          {/* Black accent fill triangle */}
          <path d="M 0 60 L 70 60 L 0 130 Z" fill="#00e87b" opacity="0.15" />
          <path d="M 0 60 L 70 60 L 0 130 Z" fill="none" stroke="#00e87b" strokeWidth="1.5" />
          {/* Text lines on paper */}
          <line x1="15" y1="20" x2="55" y2="20" stroke="#e6edf3" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="15" y1="35" x2="60" y2="35" stroke="#9ba4af" strokeWidth="2" strokeLinecap="round" />
          <line x1="15" y1="48" x2="45" y2="48" stroke="#9ba4af" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* ─── HUMAN CHARACTER 2: Reviewing Report with Sparkle ✦ ─── */}
        <g transform="translate(280, 190)" className="human-figure-2">
          {/* Head */}
          <circle cx="80" cy="60" r="32" stroke="#e6edf3" strokeWidth="2.5" fill="#0a0e14" />
          <circle cx="88" cy="60" r="3.5" fill="#00e87b" /> {/* Eye */}
          {/* Nose profile */}
          <path d="M 88 60 L 98 65" stroke="#e6edf3" strokeWidth="2" strokeLinecap="round" />
          {/* Arm holding Sparkle */}
          <path
            d="M 50 85 C 20 100, 10 140, 70 140 C 130 140, 140 100, 110 85"
            stroke="#e6edf3"
            strokeWidth="2.5"
            fill="none"
          />
        </g>

        {/* ─── SPARKLE / STAR MOTIFS (✦ & ✧) (Image 1 feature) ─── */}
        {/* Sparkle 1 */}
        <g transform="translate(420, 35)" className="sparkle-float">
          <path
            d="M 20 0 Q 20 20 40 20 Q 20 20 20 40 Q 20 20 0 20 Q 20 20 20 0 Z"
            fill="url(#mintGlow)"
          />
        </g>
        {/* Sparkle 2 */}
        <g transform="translate(210, 240)" className="sparkle-float-delay">
          <path
            d="M 12 0 Q 12 12 24 12 Q 12 12 12 24 Q 12 12 0 12 Q 12 12 12 0 Z"
            fill="#5de4c7"
          />
        </g>
        {/* Sparkle 3 */}
        <g transform="translate(620, 260)" className="sparkle-float">
          <path
            d="M 16 0 Q 16 16 32 16 Q 16 16 16 32 Q 16 16 0 16 Q 16 16 16 0 Z"
            fill="#00e87b"
          />
        </g>

        {/* ─── CYBER TAG BADGES (Image 2 style) ─── */}
        {/* Badge 1: <headers/> */}
        <g transform="translate(40, 310)" className="badge-group">
          <rect x="0" y="0" width="96" height="26" rx="13" fill="#0f151f" stroke="#00e87b" strokeWidth="1" />
          <text x="48" y="17" fill="#00e87b" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
            &lt;headers/&gt;
          </text>
        </g>

        {/* Badge 2: <ssl/tls/> */}
        <g transform="translate(160, 330)" className="badge-group">
          <rect x="0" y="0" width="96" height="26" rx="13" fill="#0f151f" stroke="#5de4c7" strokeWidth="1" />
          <text x="48" y="17" fill="#5de4c7" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
            &lt;ssl/tls/&gt;
          </text>
        </g>

        {/* Badge 3: <secrets/> */}
        <g transform="translate(480, 20)" className="badge-group">
          <rect x="0" y="0" width="96" height="26" rx="13" fill="#0f151f" stroke="#d0679d" strokeWidth="1" />
          <text x="48" y="17" fill="#d0679d" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
            &lt;secrets/&gt;
          </text>
        </g>

        {/* Badge 4: <cve_scan/> */}
        <g transform="translate(600, 110)" className="badge-group">
          <rect x="0" y="0" width="100" height="26" rx="13" fill="#0f151f" stroke="#00e87b" strokeWidth="1" />
          <text x="50" y="17" fill="#00e87b" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
            &lt;cve_scan/&gt;
          </text>
        </g>

        {/* Corner Blueprint Markers (Image 2 style) */}
        <path d="M 10 20 L 10 10 L 20 10" stroke="#00e87b" strokeWidth="1.5" fill="none" />
        <path d="M 710 20 L 710 10 L 700 10" stroke="#00e87b" strokeWidth="1.5" fill="none" />
        <path d="M 10 380 L 10 390 L 20 390" stroke="#00e87b" strokeWidth="1.5" fill="none" />
        <path d="M 710 380 L 710 390 L 700 390" stroke="#00e87b" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}

/**
 * HumanAuthIllustration - A continuous line illustration for Auth (Login / Signup)
 */
export function HumanAuthIllustration() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
      <svg width="140" height="110" viewBox="0 0 140 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Character Head */}
        <circle cx="70" cy="40" r="26" stroke="#e6edf3" strokeWidth="2" fill="#0a0e14" />
        <circle cx="76" cy="38" r="3" fill="#00e87b" /> {/* Eye */}
        <path d="M 76 38 L 84 42" stroke="#e6edf3" strokeWidth="1.5" strokeLinecap="round" /> {/* Nose */}

        {/* Top Bun Hair */}
        <circle cx="70" cy="11" r="9" fill="#e6edf3" />

        {/* Body Arms around Keyhole Shield */}
        <path
          d="M 40 60 C 25 75, 25 100, 70 100 C 115 100, 115 75, 100 60"
          stroke="#e6edf3"
          strokeWidth="2"
          fill="none"
        />

        {/* Central Keyhole Emblem */}
        <g transform="translate(56, 52)">
          <rect x="0" y="0" width="28" height="34" rx="4" fill="#0f151f" stroke="#00e87b" strokeWidth="1.5" />
          <circle cx="14" cy="12" r="5" fill="#00e87b" />
          <path d="M 14 14 L 17 24 L 11 24 Z" fill="#00e87b" />
        </g>

        {/* Sparkles */}
        <path d="M 22 25 Q 22 33 30 33 Q 22 33 22 41 Q 22 33 14 33 Q 22 33 22 25 Z" fill="#00e87b" opacity="0.8" />
        <path d="M 115 20 Q 115 26 121 26 Q 115 26 115 32 Q 115 26 109 26 Q 115 26 115 20 Z" fill="#5de4c7" opacity="0.8" />
      </svg>
    </div>
  );
}

/**
 * HumanEmptyState - Continuous line art for empty project list or search results
 */
export function HumanEmptyState({ title = 'no_data_found', description = 'Run a scan to get started' }) {
  return (
    <div className="empty-state glass-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
      <svg width="120" height="100" viewBox="0 0 120 100" fill="none" style={{ margin: '0 auto 1rem' }}>
        <circle cx="60" cy="40" r="30" stroke="#e6edf3" strokeWidth="2" fill="#0d1117" />
        <circle cx="68" cy="38" r="3" fill="#5de4c7" />
        <path d="M 68 38 L 76 42" stroke="#e6edf3" strokeWidth="1.5" strokeLinecap="round" />
        {/* Magnifying keyhole */}
        <circle cx="45" cy="55" r="14" stroke="#00e87b" strokeWidth="2" fill="#0f151f" />
        <line x1="35" y1="65" x2="22" y2="78" stroke="#00e87b" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="45" cy="52" r="3.5" fill="#00e87b" />
        <path d="M 45 54 L 47 62 L 43 62 Z" fill="#00e87b" />
        {/* Sparkle */}
        <path d="M 95 20 Q 95 26 101 26 Q 95 26 95 32 Q 95 26 89 26 Q 95 26 95 20 Z" fill="#00e87b" />
      </svg>
      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{title}</h3>
      <p className="text-muted text-sm" style={{ marginTop: '0.5rem', maxWidth: '420px', margin: '0.5rem auto 1.5rem' }}>
        {description}
      </p>
    </div>
  );
}

/**
 * NodeTracerLine - Glowing connector line with dot endpoints (Image 2 style)
 */
export function NodeTracerLine({ label, labelColor = 'var(--accent)' }) {
  return (
    <div className="node-tracer-line">
      <div className="node-tracer-dot" />
      <div className="node-tracer-bar" />
      {label && <span className="node-tracer-label" style={{ color: labelColor }}>{label}</span>}
      <div className="node-tracer-bar" />
      <div className="node-tracer-dot" />
    </div>
  );
}
