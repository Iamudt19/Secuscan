import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { HumanAuthIllustration, NodeTracerLine } from '../components/HumanIllustrations';

export default function Auth({ onLoginSuccess, initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab); // 'login' | 'register' | 'forgot' | 'reset' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const googleBtnRef = useRef(null);

  // Google Sign-In handler
  const handleGoogleCredential = async (response) => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      setIsLoading(false);
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed.');
      onLoginSuccess(data.user);
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  // Initialize Google Identity Services button
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
    });

    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: '100%',
      });
    }
  }, [tab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token') || params.get('token');
    const path = window.location.pathname;

    if (path.includes('verify-email') || verifyToken) {
      setToken(verifyToken || '');
      setTab('verify');
    } else if (path.includes('reset-password')) {
      setToken(verifyToken || '');
      setTab('reset');
    }
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) throw new Error(data.error || 'Registration failed.');
      setMessage(data.message);
      setTab('verify');
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) throw new Error(data.error || 'Login failed.');
      onLoginSuccess(data.user);
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) throw new Error(data.error || 'Verification failed.');
      setMessage(data.message);
      setTab('login');
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) throw new Error(data.error || 'Request failed.');
      setMessage(data.message);
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) throw new Error(data.error || 'Reset failed.');
      setMessage(data.message);
      setTab('login');
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  };

  return (
    <section className="hero" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="container" style={{ maxWidth: '480px' }}>
        <div className="glass-card" style={{ padding: '2.5rem 2rem', width: '100%' }}>
          
          {/* Continuous Line Vector Art for Auth */}
          <HumanAuthIllustration />

          {/* Navigation Tabs (Image 2 aesthetic) */}
          {['login', 'register'].includes(tab) && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-panel)', marginBottom: '1.75rem' }}>
              <button
                type="button"
                className={`btn ${tab === 'login' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, borderRadius: 'var(--radius) var(--radius) 0 0', borderBottom: 'none' }}
                onClick={() => { setTab('login'); setError(''); setMessage(''); }}
              >
                &lt;login/&gt;
              </button>
              <button
                type="button"
                className={`btn ${tab === 'register' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, borderRadius: 'var(--radius) var(--radius) 0 0', borderBottom: 'none' }}
                onClick={() => { setTab('register'); setError(''); setMessage(''); }}
              >
                &lt;register/&gt;
              </button>
            </div>
          )}

          {/* Titles for non-tab views */}
          {tab === 'forgot' && <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }} className="gradient-text">&lt;forgot_password/&gt;</h2>}
          {tab === 'reset' && <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }} className="gradient-text">&lt;reset_password/&gt;</h2>}
          {tab === 'verify' && <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }} className="gradient-text">&lt;verify_email/&gt;</h2>}

          {/* Banners */}
          {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{'error: '}{error}</div>}
          {message && <div className="info-banner" style={{ marginBottom: '1rem' }}>{message}</div>}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="scan-form__project">
                <label htmlFor="login-email">// email_address</label>
                <input
                  id="login-email"
                  type="email"
                  className="scan-form__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dev@example.com"
                  required
                />
              </div>
              <div className="scan-form__project">
                <label htmlFor="login-password">// password</label>
                <input
                  id="login-password"
                  type="password"
                  className="scan-form__input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                {isLoading ? 'authenticating...' : 'authenticate()'}
              </button>

              {/* Google Sign-In Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0 0.25rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-panel)' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>// or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-panel)' }} />
              </div>

              {/* Google Sign-In Button */}
              <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }} />

              <div style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}
                  onClick={() => setTab('forgot')}
                >
                  // forgot_password()?
                </button>
              </div>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="scan-form__project">
                <label htmlFor="reg-email">// email_address</label>
                <input
                  id="reg-email"
                  type="email"
                  className="scan-form__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dev@example.com"
                  required
                />
              </div>
              <div className="scan-form__project">
                <label htmlFor="reg-password">// password</label>
                <input
                  id="reg-password"
                  type="password"
                  className="scan-form__input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                  Must be 8+ chars (uppercase, lowercase &amp; number).
                </span>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                {isLoading ? 'creating_account...' : 'create_account()'}
              </button>
            </form>
          )}

          {/* Verify Token Form */}
          {tab === 'verify' && (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Verification token sent to your email. Check your server console logs for the hex token and paste below:
              </p>
              <div className="scan-form__project">
                <label htmlFor="verify-token">// verification_token</label>
                <input
                  id="verify-token"
                  type="text"
                  className="scan-form__input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="64-char hex token"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                {isLoading ? 'verifying...' : 'verify()'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem', width: '100%', justifyContent: 'center' }} onClick={() => setTab('login')}>
                &lt;- back to login
              </button>
            </form>
          )}

          {/* Forgot Password Request Form */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="scan-form__project">
                <label htmlFor="forgot-email">// email_address</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="scan-form__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dev@example.com"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                {isLoading ? 'sending...' : 'request_reset()'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem', width: '100%', justifyContent: 'center' }} onClick={() => setTab('login')}>
                &lt;- back to login
              </button>
            </form>
          )}

          {/* Reset Password Form */}
          {tab === 'reset' && (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="scan-form__project">
                <label htmlFor="reset-token">// reset_token</label>
                <input
                  id="reset-token"
                  type="text"
                  className="scan-form__input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Reset Token"
                  required
                />
              </div>
              <div className="scan-form__project">
                <label htmlFor="reset-password">// new_password</label>
                <input
                  id="reset-password"
                  type="password"
                  className="scan-form__input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                {isLoading ? 'updating...' : 'update_password()'}
              </button>
            </form>
          )}

        </div>
      </div>
    </section>
  );
}
