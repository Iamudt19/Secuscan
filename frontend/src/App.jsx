import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Results from './pages/Results';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Auth from './pages/Auth';
import Settings from './pages/Settings';
import Contact from './pages/Contact';
import AdminPortal from './pages/AdminPortal';
import AttackSurface from './pages/AttackSurface';
import Watchdog from './pages/Watchdog';
import RedTeamSimulator from './pages/RedTeamSimulator';
import LandingPage from './pages/LandingPage';
import { API_BASE_URL } from './config';
import { NodeTracerLine } from './components/HumanIllustrations';

// ─── Check if user navigated directly to /admin ──────────────────────────────
const IS_ADMIN_ROUTE = window.location.pathname === '/admin';

export default function App() {
  const [view, setView] = useState('landing');
  const [scanId, setScanId] = useState(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [prefilledProjectName, setPrefilledProjectName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [navOpen, setNavOpen] = useState(true);

  // Check user session on boot
  useEffect(() => {
    // If directly visiting /admin, skip session check and go straight there
    if (IS_ADMIN_ROUTE) {
      setIsCheckingAuth(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/auth/me`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          setView('home');
        } else {
          setView('landing');
        }
        setIsCheckingAuth(false);
      })
      .catch(() => {
        setView('landing');
        setIsCheckingAuth(false);
      });
  }, []);

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const requireAuth = (destination) => {
    if (!currentUser) {
      setView('auth');
    } else {
      setView(destination);
    }
  };

  const handleSelectScan = (id) => {
    setScanId(id);
    setView('results');
  };

  const handleScanStart = (id, url) => {
    setScanId(id);
    setTargetUrl(url);
    setView('results');
  };

  const handleNewScan = () => {
    setScanId(null);
    setTargetUrl('');
    setPrefilledProjectName('');
    if (!currentUser) { setView('landing'); return; }
    setView('home');
  };

  const handleSelectProject = (id) => {
    setSelectedProjectId(id);
    setView('project-detail');
  };

  const handleScanProjectTarget = (type, projectName, existingUrl) => {
    setPrefilledProjectName(projectName);
    setTargetUrl(existingUrl);
    setView('home');
    setTimeout(() => {
      const typeBtn = document.querySelectorAll('.scan-form__toggle-btn');
      typeBtn.forEach((btn) => {
        if (type === 'repo' && btn.textContent.includes('repo')) btn.click();
        if (type === 'website' && btn.textContent.includes('web')) btn.click();
      });
      const urlInput = document.getElementById('scan-url-input');
      if (urlInput) {
        urlInput.value = existingUrl;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const projInput = document.getElementById('project-name');
      if (projInput) {
        projInput.value = projectName;
        projInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 100);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
    } catch {}
    setCurrentUser(null);
    setView('landing');
  };

  // ── Loading spinner ─────────────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="scan-status__spinner" style={{ marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace" }}>
          establishing_secure_session...
        </p>
      </div>
    );
  }

  // ── /admin route — full-page, no navbar ────────────────────────────────────
  if (IS_ADMIN_ROUTE) {
    return <AdminPortal />;
  }

  // ── Landing page for guests ────────────────────────────────────────────────
  if (!currentUser && view !== 'auth') {
    return <LandingPage onGetStarted={() => setView('auth')} />;
  }

  // ── Auth page (no navbar) ──────────────────────────────────────────────────
  if (view === 'auth') {
    return (
      <Auth
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setView('home');
        }}
        onBack={currentUser ? () => setView('home') : null}
      />
    );
  }

  // ── Main app — logged-in only ──────────────────────────────────────────────
  const isActiveScan = ['home', 'results'].includes(view);
  const isActiveProjects = ['dashboard', 'project-detail'].includes(view);

  const navItems = [
    { label: '<Scan/>', active: isActiveScan, onClick: () => setView('home') },
    { label: '<Projects/>', active: isActiveProjects, onClick: () => setView('dashboard') },
    { label: '<Watchdog/>', active: view === 'watchdog', onClick: () => setView('watchdog') },
    { label: '<RedTeam/>', active: view === 'redteam', onClick: () => setView('redteam') },
    { label: '<Contact/>', active: view === 'contact', onClick: () => setView('contact') },
  ];

  return (
    <>
      <style>{`
        @keyframes navSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nav-collapse-enter {
          animation: navSlideDown 0.25s ease both;
        }
        .nav-toggle-btn {
          background: rgba(0,255,128,0.08);
          border: 1px solid rgba(0,255,128,0.25);
          border-radius: 8px;
          padding: 0.35rem 0.75rem;
          color: var(--cyan);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex; align-items: center; gap: 0.4rem;
        }
        .nav-toggle-btn:hover {
          background: rgba(0,255,128,0.15);
          border-color: var(--cyan);
        }
        .nav-chevron {
          transition: transform 0.25s ease;
          display: inline-block;
        }
        .nav-chevron.open { transform: rotate(180deg); }
      `}</style>

      {/* Navbar */}
      <nav className="navbar" aria-label="Main navigation">
        <div className="container--wide navbar__inner" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>

          {/* Logo + toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a
              href="/"
              className="navbar__logo"
              onClick={(e) => { e.preventDefault(); setView('home'); }}
            >
              <div className="navbar__logo-icon" aria-hidden="true">✦</div>
              Vulta
            </a>

            {/* Collapse toggle button */}
            <button
              className="nav-toggle-btn"
              onClick={() => setNavOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              menu
              <span className={`nav-chevron ${navOpen ? 'open' : ''}`}>▾</span>
            </button>
          </div>

          {/* Collapsible nav links */}
          {navOpen && (
            <div
              className="nav-collapse-enter"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, justifyContent: 'space-between' }}
            >
              {/* Page links */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`btn ${item.active ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                    onClick={item.onClick}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Right: settings + user */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn ${view === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  onClick={() => setView('settings')}
                >
                  &lt;Settings/&gt;
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--cyan)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {currentUser.email.split('@')[0]}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', color: 'var(--sev-critical)' }}
                    onClick={handleLogout}
                  >
                    exit()
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main id="main-content">
        {view === 'home' && (
          <Home
            onScanStart={handleScanStart}
            onSelectScan={handleSelectScan}
            prefillProjectName={prefilledProjectName}
            prefillUrl={targetUrl}
            currentUser={currentUser}
          />
        )}
        {view === 'results' && (
          <Results
            scanId={scanId}
            targetUrl={targetUrl}
            onNewScan={handleNewScan}
          />
        )}
        {view === 'dashboard' && (
          <Dashboard
            onSelectProject={handleSelectProject}
            onScanProject={(id, name) => handleScanProjectTarget('website', name, '')}
          />
        )}
        {view === 'project-detail' && (
          <ProjectDetail
            projectId={selectedProjectId}
            onBack={() => setView('dashboard')}
            onScanTarget={handleScanProjectTarget}
          />
        )}
        {view === 'watchdog' && <Watchdog currentUser={currentUser} onNavigateToAuth={() => setView('auth')} />}
        {view === 'redteam' && <RedTeamSimulator />}
        {view === 'contact' && <Contact />}
        {view === 'settings' && (
          <Settings
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigateToAuth={() => setView('auth')}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ padding: '2rem 0', marginTop: '4rem', textAlign: 'center' }}>
        <div className="container--wide">
          <NodeTracerLine label="Vulta v1.0 — Scan. Fix. Ship Fearless." labelColor="var(--text-muted)" />
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Home</button>
            <button type="button" onClick={() => setView('dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Projects</button>
            <button type="button" onClick={() => setView('watchdog')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Watchdog</button>
            <button type="button" onClick={() => setView('contact')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Contact</button>
            <button type="button" onClick={() => setView('settings')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Settings</button>
          </div>
        </div>
      </footer>
    </>
  );
}
