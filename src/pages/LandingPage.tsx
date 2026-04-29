import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Terminal, Code2, Rocket, Settings } from 'lucide-react';
import SettingsModal from '../components/settings/SettingsModal';
import PrivacyPolicyModal from '../components/privacy/PrivacyPolicyModal';
import SignInModal from '../components/common/SignInModal';
import { sanitizeInput } from '../utils/sanitize';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const navigate = useNavigate();

  const examples = [
    'A modern SaaS dashboard with dark mode',
    'A personal portfolio for a creative developer',
    'A real-time crypto tracker with charts',
    'A minimal landing page for an AI product',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      // SEC-03: Apply sanitization to landing page prompt
      const sanitizedPrompt = sanitizeInput(prompt);
      navigate('/builder', { state: { prompt: sanitizedPrompt } });
    }
  };

  return (
    <div className="landing-container" data-testid="landing-container">
      {/* Background Orbs */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      <header className="landing-header" data-testid="landing-header">
        <Link to="/" className="logo-container" data-testid="logo-link">
          <Sparkles className="logo-icon" />
          <span className="logo-text">
            App Builder <span>Pro</span>
          </span>
        </Link>
        <nav className="landing-nav" data-testid="landing-nav">
          <Link to="/showcase">Showcase</Link>
          <Link to="/templates">Templates</Link>
          <div className="divider-h"></div>
          <button
            className="btn-icon-landing"
            data-testid="btn-settings"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={20} />
          </button>
          <button className="btn-outline" onClick={() => setIsSignInOpen(true)}>
            Sign In
          </button>
        </nav>
      </header>

      <main className="landing-main" data-testid="landing-main">
        <motion.div
          className="hero-content"
          data-testid="hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="badge">
            <Rocket size={14} className="badge-icon" />
            <span>AI-First Builder v1.0</span>
          </div>
          <h1 className="hero-title">
            Build any app <br />
            <span className="gradient-text">with just a prompt</span>
          </h1>
          <p className="hero-description">
            The intelligent builder for non-technical founders and developers alike. Describe it,
            vibe it, and our AI constructs the code in seconds.
          </p>

          <form className="prompt-form" onSubmit={handleSubmit}>
            <div className="prompt-input-wrapper glass" data-testid="prompt-input-wrapper">
              <Terminal className="input-icon" />
              <input
                type="text"
                data-testid="prompt-input"
                placeholder="What do you want to build today?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="btn-primary"
                data-testid="btn-primary"
                disabled={!prompt.trim()}
              >
                Build App
              </button>
            </div>
          </form>

          <div className="examples-container">
            <span className="examples-label">Try these:</span>
            <div className="examples-list">
              {examples.map((ex, i) => (
                <button key={i} className="example-chip glass" onClick={() => setPrompt(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          className="feature-grid"
          data-testid="feature-grid"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="feature-card glass">
            <Code2 className="feature-icon" />
            <h3>Real Code Generation</h3>
            <p>Generated React and Tailwind code you can actually own and export.</p>
          </div>
          <div className="feature-card glass">
            <Terminal className="feature-icon" />
            <h3>In-Browser Preview</h3>
            <p>Run your application instantly inside our sandboxed execution engine.</p>
          </div>
          <div className="feature-card glass">
            <Sparkles className="feature-icon" />
            <h3>Iterative Building</h3>
            <p>Refine your app by simply chatting with the AI agent.</p>
          </div>
        </motion.div>
      </main>

      <footer className="landing-footer" data-testid="landing-footer">
        <p>© 2026 App Builder Pro AI Labs. Built with &lt;3 for builders.</p>
        <button type="button" className="privacy-link" onClick={() => setIsPrivacyOpen(true)}>
          Privacy Policy
        </button>
      </footer>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </div>
  );
};

export default LandingPage;
