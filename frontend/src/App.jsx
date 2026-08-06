import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Results from './pages/Results';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Auth from './pages/Auth';
import Docs from './pages/Docs';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Benchmark from './pages/Benchmark';
import { API_BASE_URL } from './config';
import { NodeTracerLine } from './components/HumanIllustrations';

export default function App() {
  const [view, setView]               = useState('home'); // 'home' | 'results' | 'dashboard' | 'project-detail' | 'auth' | 'docs' | 'library' | 'settings' | 'benchmark'
  const [scanId, setScanId]           = useState(null);
  const [targetUrl, setTargetUrl]     = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [prefilledProjectName, setPrefilledProjectName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check user session on boot
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
        setIsCheckingAuth(false);
      })
      .catch(() => {
        setIsCheckingAuth(false);
      });
  }, []);

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
      setCurrentUser(null);
      setView('home');
    } catch {}
  };

  const handleDashboardClick = () => {
    if (!currentUser) {
      setView('auth');
    } else {
      setView('dashboard');
    }
  };

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

  const isActiveScan = ['home', 'results'].includes(view);
  const isActiveProjects = ['dashboard', 'project-detail'].includes(view);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar" aria-label="Main navigation">
        <div className="container--wide navbar__inner" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <a href="/" className="navbar__logo" onClick={(e) => { e.preventDefault(); handleNewScan(); }}>
              <div className="navbar__logo-icon" aria-hidden="true">✦</div>
              Vulta
            </a>

            {/* Code-style Navigation Links */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${isActiveScan ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={handleNewScan}
              >
                &lt;Scan/&gt;
              </button>

              <button
                type="button"
                className={`btn ${isActiveProjects ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={handleDashboardClick}
              >
                &lt;Projects/&gt;
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className={`btn ${view === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => setView('settings')}
            >
              &lt;Settings/&gt;
            </button>

            {currentUser ? (
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
            ) : (
              <button
                type="button"
                className={`btn ${view === 'auth' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={() => setView('auth')}
              >
                &lt;Auth/&gt;
              </button>
            )}
          </div>
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
        {view === 'auth' && (
          <Auth
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setView('dashboard');
            }}
          />
        )}
        {view === 'docs' && <Docs />}
        {view === 'library' && <Library />}
        {view === 'settings' && (
          <Settings
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigateToAuth={() => setView('auth')}
          />
        )}
        {view === 'benchmark' && <Benchmark />}
      </main>

      {/* Footer */}
      <footer style={{ padding: '2rem 0', marginTop: '4rem', textAlign: 'center' }}>
        <div className="container--wide">
          <NodeTracerLine label="Vulta v1.0 — Scan. Fix. Ship Fearless." labelColor="var(--text-muted)" />
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.78rem' }}>
            <button type="button" onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Home</button>
            <button type="button" onClick={handleDashboardClick} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Projects</button>
            <button type="button" onClick={() => setView('settings')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Settings</button>
          </div>
        </div>
      </footer>
    </>
  );
}
