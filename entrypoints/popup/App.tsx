import { useState, useEffect, useCallback } from 'react';
import { loadSettings, updateSettings } from '../../utils/storage';
import { broadcastSettingsUpdate } from '@/utils/messages.ts';
import type { LexiLensSettings, BrowserAIConfig } from '../../types';
import './App.css';

function App() {
  const [settings, setSettings] = useState<LexiLensSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [customTermInput, setCustomTermInput] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });

    // Check WebGPU support
    checkWebGPU();
  }, []);

  const checkWebGPU = async () => {
    try {
      if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        setWebGPUSupported(false);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gpu = (navigator as any).gpu;
      if (!gpu) {
        setWebGPUSupported(false);
        return;
      }
      const adapter = await gpu.requestAdapter();
      setWebGPUSupported(adapter !== null);
    } catch {
      setWebGPUSupported(false);
    }
  };

  // Update a setting and sync across tabs
  const handleSettingChange = useCallback(
    async <K extends keyof LexiLensSettings>(key: K, value: LexiLensSettings[K]) => {
      if (!settings) return;

      const updated = { ...settings, [key]: value };
      setSettings(updated);

      await updateSettings({ [key]: value });
      await broadcastSettingsUpdate({ [key]: value });
    },
    [settings]
  );

  // Update browser AI config
  const handleBrowserAIChange = useCallback(
    async <K extends keyof BrowserAIConfig>(key: K, value: BrowserAIConfig[K]) => {
      if (!settings?.browserAI) return;

      const updatedAI: BrowserAIConfig = { ...settings.browserAI, [key]: value };
      const updated = { ...settings, browserAI: updatedAI };
      setSettings(updated);

      await updateSettings({ browserAI: updatedAI });
      await broadcastSettingsUpdate({ browserAI: updatedAI });
    },
    [settings]
  );

  // Add custom term
  const addCustomTerm = () => {
    if (!customTermInput.trim() || !settings?.browserAI) return;

    const currentTerms = settings.browserAI.customTerms ?? [];
    const newTerms = [...currentTerms, customTermInput.trim()];
    handleBrowserAIChange('customTerms', newTerms);
    setCustomTermInput('');
  };

  // Remove custom term
  const removeCustomTerm = (term: string) => {
    if (!settings?.browserAI) return;
    const currentTerms = settings.browserAI.customTerms ?? [];
    const newTerms = currentTerms.filter(t => t !== term);
    handleBrowserAIChange('customTerms', newTerms);
  };

  if (loading || !settings) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const customTerms = settings.browserAI?.customTerms ?? [];

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <h1>
          <span className="logo">✨</span>
          LexiLens
        </h1>
        <p className="tagline">Built for dyslexic minds</p>
      </header>

      {/* What Makes Us Different */}
      <section className="difference-banner">
        <div className="difference-icon">🧠</div>
        <div className="difference-text">
          <strong>Not just another spell checker</strong>
          <span>We understand how dyslexic brains work</span>
        </div>
      </section>

      {/* Main Settings */}
      <main className="popup-main">
        {/* Enable/Disable Section */}
        <section className="settings-section">
          <div className="setting-row">
            <div className="setting-info">
              <label htmlFor="correction-toggle">Enable LexiLens</label>
              <span className="setting-description">
                Highlight dyslexia-specific spelling patterns
              </span>
            </div>
            <label className="toggle">
              <input
                id="correction-toggle"
                type="checkbox"
                checked={settings.correctionEnabled}
                onChange={(e) => handleSettingChange('correctionEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {settings.correctionEnabled && (
          <>
            {/* Smart AI - Simplified single toggle */}
            {webGPUSupported && (
              <section className="settings-section ai-section">
                <div className="setting-row">
                  <div className="setting-info">
                    <label>🚀 Enhanced Mode</label>
                    <span className="setting-description">
                      Smarter suggestions using on-device AI
                    </span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.browserAI?.enabled ?? false}
                      onChange={(e) => handleBrowserAIChange('enabled', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {settings.browserAI?.enabled && (
                  <p className="ai-note">
                    ✨ AI model will download once (~100MB), then runs 100% offline
                  </p>
                )}
              </section>
            )}

            {/* Custom Terms Section */}
            <section className="settings-section">
              <div className="setting-info" style={{ marginBottom: '10px' }}>
                <label>📝 My Dictionary</label>
                <span className="setting-description">
                  Add words that shouldn't be flagged
                </span>
              </div>

              <div className="custom-terms-input">
                <input
                  type="text"
                  placeholder="e.g., Kubernetes, OAuth"
                  value={customTermInput}
                  onChange={(e) => setCustomTermInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomTerm()}
                />
                <button type="button" onClick={addCustomTerm}>Add</button>
              </div>

              {customTerms.length > 0 && (
                <div className="custom-terms-list">
                  {customTerms.map((term) => (
                    <span key={term} className="custom-term">
                      {term}
                      <button type="button" onClick={() => removeCustomTerm(term)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Privacy Section */}
            <section className="settings-section privacy-section">
              <div className="privacy-badge">
                <span className="privacy-icon">🔒</span>
                <div>
                  <strong>100% Private</strong>
                  <span>Everything runs locally. Your text never leaves your device.</span>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="popup-footer">
        <div className="footer-text">Made with ❤️ for dyslexic writers</div>
        <div className="version">v1.0.0</div>
      </footer>
    </div>
  );
}

export default App;

