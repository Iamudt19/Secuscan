import { useState } from 'react';
import { API_BASE_URL } from '../config';
import { NodeTracerLine } from '../components/HumanIllustrations';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: '', success: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setStatus({ loading: false, error: res.ok ? '' : (data.error || 'Failed to send message'), success: res.ok ? data.message : '' });
      if (res.ok) {
        setFormData({ name: '', email: '', subject: '', message: '' });
      }
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: '' });
    }
  };

  return (
    <div style={{ padding: '2.5rem 0' }}>
      <div className="container--wide" style={{ maxWidth: '800px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div className="code-tag code-tag--accent" style={{ marginBottom: '0.5rem' }}>
            ✦ // get_in_touch
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>
            &lt;contact_us/&gt;
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Have questions, feedback, or security inquiries? Reach out to the Vulta engineering team.
          </p>
        </div>

        <NodeTracerLine label="// connect_with_vulta" />

        {/* Social Links Bar */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem', textAlign: 'center' }}>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: '0.9rem', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '0.2rem' }}>🐙</span>
            GitHub
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--accent)', fontSize: '0.9rem', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '0.2rem' }}>🐦</span>
            Twitter / X
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: '0.9rem', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '0.2rem' }}>💼</span>
            LinkedIn
          </a>
          <a href="https://discord.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--accent)', fontSize: '0.9rem', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '0.2rem' }}>💬</span>
            Discord
          </a>
          <a href="mailto:security@vulta.dev" style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: '0.9rem', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '0.2rem' }}>✉️</span>
            Email Us
          </a>
        </div>

        {/* Contact Form */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', color: 'var(--accent)' }}>
            ✦ Send Direct Inquiry
          </h2>

          {status.error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{status.error}</div>}
          {status.success && <div className="info-banner" style={{ marginBottom: '1rem' }}>{status.success}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="scan-form__project">
                <label htmlFor="contact-name">// full_name</label>
                <input
                  id="contact-name"
                  type="text"
                  className="scan-form__input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="scan-form__project">
                <label htmlFor="contact-email">// email_address</label>
                <input
                  id="contact-email"
                  type="email"
                  className="scan-form__input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jane@company.com"
                  required
                />
              </div>
            </div>

            <div className="scan-form__project">
              <label htmlFor="contact-subject">// subject</label>
              <input
                id="contact-subject"
                type="text"
                className="scan-form__input"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Enterprise Scan Inquiry / General Feedback"
                required
              />
            </div>

            <div className="scan-form__project">
              <label htmlFor="contact-message">// message_body</label>
              <textarea
                id="contact-message"
                rows="5"
                className="scan-form__input"
                style={{ resize: 'vertical', fontFamily: "'JetBrains Mono', monospace" }}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="How can we assist with your security posture?"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={status.loading}
              style={{ justifyContent: 'center', marginTop: '0.5rem' }}
            >
              {status.loading ? 'transmitting...' : 'transmit_message()'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
