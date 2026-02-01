import { useState, useEffect, useCallback } from 'react';
import { loadSettings, updateSettings } from '../../utils/storage';
import { broadcastSettingsUpdate } from '../../utils/messages';
import type { LexiLensSettings } from '../../types';
import './App.css';

function App() {
  const [settings, setSettings] = useState<LexiLensSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  // Update a setting and sync across tabs
  const handleSettingChange = useCallback(
    async (key: keyof LexiLensSettings, value: LexiLensSettings[keyof LexiLensSettings]) => {
      if (!settings) return;

      const updated = { ...settings, [key]: value };
      setSettings(updated);

      await updateSettings({ [key]: value });
      await broadcastSettingsUpdate({ [key]: value });
    },
    [settings]
  );

  if (loading || !settings) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <h1>
          <span className="logo">✨</span>
          LexiLens
        </h1>
        <p className="tagline">Your dyslexia-friendly assistant</p>
      </header>

      {/* Main Settings */}
      <main className="popup-main">
        {/* Reading Ruler Section */}
        <section className="settings-section">
          <div className="setting-row">
            <div className="setting-info">
              <label htmlFor="ruler-toggle">Reading Ruler</label>
              <span className="setting-description">
                Colored band that follows your mouse
              </span>
            </div>
            <label className="toggle">
              <input
                id="ruler-toggle"
                type="checkbox"
                checked={settings.rulerEnabled}
                onChange={(e) => handleSettingChange('rulerEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {settings.rulerEnabled && (
            <div className="setting-options">
              {/* Color Picker */}
              <div className="setting-row compact">
                <label htmlFor="ruler-color">Color</label>
                <input
                  id="ruler-color"
                  type="color"
                  value={settings.rulerColor}
                  onChange={(e) => handleSettingChange('rulerColor', e.target.value)}
                />
              </div>

              {/* Opacity Slider */}
              <div className="setting-row compact">
                <label htmlFor="ruler-opacity">
                  Opacity: {Math.round(settings.rulerOpacity * 100)}%
                </label>
                <input
                  id="ruler-opacity"
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={settings.rulerOpacity}
                  onChange={(e) => handleSettingChange('rulerOpacity', parseFloat(e.target.value))}
                />
              </div>

              {/* Height Slider */}
              <div className="setting-row compact">
                <label htmlFor="ruler-height">
                  Height: {settings.rulerHeight}px
                </label>
                <input
                  id="ruler-height"
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={settings.rulerHeight}
                  onChange={(e) => handleSettingChange('rulerHeight', parseInt(e.target.value))}
                />
              </div>
            </div>
          )}
        </section>

        {/* Text Correction Section */}
        <section className="settings-section">
          <div className="setting-row">
            <div className="setting-info">
              <label htmlFor="correction-toggle">Spelling Help</label>
              <span className="setting-description">
                Phonetic spelling suggestions
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

          {settings.correctionEnabled && (
            <div className="setting-options">
              <div className="setting-row compact">
                <label htmlFor="ai-provider">AI Provider</label>
                <select
                  id="ai-provider"
                  value={settings.aiProvider}
                  onChange={(e) =>
                    handleSettingChange('aiProvider', e.target.value as 'openai' | 'local' | 'none')
                  }
                >
                  <option value="local">Local Dictionary Only</option>
                  <option value="openai">OpenAI (requires API key)</option>
                  <option value="none">Disabled</option>
                </select>
              </div>

              {settings.aiProvider === 'openai' && (
                <div className="setting-row compact">
                  <label htmlFor="api-key">API Key</label>
                  <input
                    id="api-key"
                    type="password"
                    placeholder="sk-..."
                    value={settings.apiKey || ''}
                    onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="popup-footer">
        <div className="shortcuts">
          <kbd>Alt</kbd>+<kbd>R</kbd> Toggle Ruler
        </div>
        <div className="version">v1.0.0</div>
      </footer>
    </div>
  );
}

export default App;
