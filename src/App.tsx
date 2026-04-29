import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import BuilderPage from './pages/BuilderPage';
import ShowcasePage from './pages/ShowcasePage';
import TemplatesPage from './pages/TemplatesPage';
import CookieConsentBanner from './components/privacy/CookieConsentBanner';
import { useCookieConsent } from './hooks/useCookieConsent';

function App() {
  const { hasConsented, acceptAll, rejectNonEssential } = useCookieConsent();

  return (
    <div className="app-container" data-testid="app-container">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/showcase" element={<ShowcasePage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/builder/:projectId?" element={<BuilderPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hasConsented && <CookieConsentBanner onAccept={acceptAll} onReject={rejectNonEssential} />}
    </div>
  );
}

export default App;
