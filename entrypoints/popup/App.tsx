import { useState, useEffect, useCallback } from 'react';
import { loadSettings, updateSettings } from '../../utils/storage';
import { broadcastSettingsUpdate } from '../../utils/messages';
import {
  checkWebGPUSupport,
  checkOllamaAvailable,
  BROWSER_MODELS,
  OLLAMA_MODELS,
  initBrowserAI,
  isAIReady,
} from '../../utils/ai-engine';
import type { LexiLensSettings, AIConfig, AIBackend } from '../../types';
import './App.css';

function App() {
  const [settings, setSettings] = useState<LexiLensSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [customTermInput, setCustomTermInput] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [aiReady, setAiReady] = useState(false);

  // Load settings and check capabilities
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
      setAiReady(isAIReady(s.ai));
    });

    checkWebGPUSupport().then(setWebGPUSupported);
    checkOllamaAvailable().then(setOllamaAvailable);
  }, []);

  // Update settings helper
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

  // Update AI config helper
  const handleAIChange = useCallback(
    async <K extends keyof AIConfig>(key: K, value: AIConfig[K]) => {
      if (!settings) return;
      const updatedAI = { ...settings.ai, [key]: value };
      const updated = { ...settings, ai: updatedAI };
      setSettings(updated);
      await updateSettings({ ai: updatedAI });
      await broadcastSettingsUpdate({ ai: updatedAI });
    },
    [settings]
  );

  // Download browser model
  const handleDownloadModel = async () => {
    if (!settings) return;

    setDownloadProgress(0);
    setDownloadStatus('Starting download...');

    const success = await initBrowserAI(
      settings.ai.browserModelId,
      (progress, status) => {
        setDownloadProgress(progress);
        setDownloadStatus(status);
      }
    );

    if (success) {
      setDownloadProgress(null);
      setDownloadStatus('');
      handleAIChange('modelDownloaded', true);
      setAiReady(true);
    } else {
      setDownloadProgress(null);
      setDownloadStatus('Download failed. Please try again.');
    }
  };

  // Add custom term
  const addCustomTerm = () => {
    if (!customTermInput.trim() || !settings) return;
    const newTerms = [...(settings.ai.customTerms || []), customTermInput.trim()];
    handleAIChange('customTerms', newTerms);
    setCustomTermInput('');
  };

  // Remove custom term
  const removeCustomTerm = (term: string) => {
    if (!settings) return;
    const newTerms = settings.ai.customTerms.filter(t => t !== term);
    handleAIChange('customTerms', newTerms);
  };

  if (loading || !settings) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const showBrowserOptions = settings.ai.backend === 'browser';
  const showOllamaOptions = settings.ai.backend === 'ollama';

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <h1>
          <span className="logo">✨</span>
          LexiLens
        </h1>
        <p className="tagline">AI-Powered Dyslexia Assistant</p>
      </header>

      {/* Main Toggle */}
      <main className="popup-main">
        <section className="settings-section">
          <div className="setting-row">
            <div className="setting-info">
              <label>Enable LexiLens</label>
              <span className="setting-description">
                Highlight spelling errors as you type
              </span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.correctionEnabled}
                onChange={(e) => handleSettingChange('correctionEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Dyslexic Font Toggle */}
          <div className="setting-row">
            <div className="setting-info">
              <label>📖 OpenDyslexic Font</label>
              <span className="setting-description">
                Apply dyslexia-friendly font to web pages
              </span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.dyslexicFontEnabled || false}
                onChange={(e) => handleSettingChange('dyslexicFontEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {settings.correctionEnabled && (
          <>
            {/* AI Backend Selection */}
            <section className="settings-section">
              <h3 className="section-title">🤖 AI Engine</h3>

              <div className="backend-options">
                {/* Browser AI Option */}
                <label className={`backend-option ${settings.ai.backend === 'browser' ? 'selected' : ''} ${!webGPUSupported ? 'disabled' : ''}`}>
                  <input
                    type="radio"
                    name="backend"
                    value="browser"
                    checked={settings.ai.backend === 'browser'}
                    onChange={() => handleAIChange('backend', 'browser')}
                    disabled={!webGPUSupported}
                  />
                  <div className="backend-content">
                    <div className="backend-header">
                      <span className="backend-icon">🌐</span>
                      <span className="backend-name">Browser AI</span>
                      {!webGPUSupported && <span className="badge-warning">Not Supported</span>}
                    </div>
                    <p className="backend-desc">
                      Runs in your browser. One-time download, then works offline.
                    </p>
                  </div>
                </label>

                {/* Ollama Option */}
                <label className={`backend-option ${settings.ai.backend === 'ollama' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="backend"
                    value="ollama"
                    checked={settings.ai.backend === 'ollama'}
                    onChange={() => handleAIChange('backend', 'ollama')}
                  />
                  <div className="backend-content">
                    <div className="backend-header">
                      <span className="backend-icon">🦙</span>
                      <span className="backend-name">Ollama</span>
                      {ollamaAvailable === true && <span className="badge-success">Running</span>}
                      {ollamaAvailable === false && <span className="badge-warning">Not Found</span>}
                    </div>
                    <p className="backend-desc">
                      Local AI server. More models, better accuracy.
                      <a href="https://ollama.ai" target="_blank" rel="noopener"> Get Ollama →</a>
                    </p>
                  </div>
                </label>
              </div>
            </section>

            {/* Browser Model Selection */}
            {showBrowserOptions && webGPUSupported && (
              <section className="settings-section">
                <h3 className="section-title">📦 Select Model</h3>

                <select
                  className="model-select"
                  value={settings.ai.browserModelId}
                  onChange={(e) => {
                    handleAIChange('browserModelId', e.target.value);
                    handleAIChange('modelDownloaded', false);
                    setAiReady(false);
                  }}
                >
                  {BROWSER_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.size}) - {model.description}
                    </option>
                  ))}
                </select>

                {/* Download Button - show when not downloaded */}
                {!settings.ai.modelDownloaded && downloadProgress === null && (
                  <div className="download-section">
                    <button className="download-btn" onClick={handleDownloadModel}>
                      ⬇️ Download Model
                    </button>
                    <p className="download-note">
                      Model will be cached in your browser. Only downloads once.
                    </p>
                  </div>
                )}

                {/* Download Progress */}
                {downloadProgress !== null && (
                  <div className="download-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${downloadProgress * 100}%` }}
                      />
                    </div>
                    <span className="progress-text">{downloadStatus}</span>
                  </div>
                )}

                {/* Ready Status - show when downloaded */}
                {settings.ai.modelDownloaded && (
                  <div className="status-ready">
                    <span className="status-icon">✅</span>
                    <div className="status-text">
                      <strong>Model ready!</strong>
                      <span>Cached in browser - works offline</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Ollama Model Selection */}
            {showOllamaOptions && (
              <section className="settings-section">
                <h3 className="section-title">📦 Select Model</h3>

                {ollamaAvailable ? (
                  <>
                    <select
                      className="model-select"
                      value={settings.ai.ollamaModelId}
                      onChange={(e) => handleAIChange('ollamaModelId', e.target.value)}
                    >
                      {OLLAMA_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} - {model.description}
                        </option>
                      ))}
                    </select>
                    <p className="hint">
                      Run <code>ollama pull {settings.ai.ollamaModelId}</code> if not installed
                    </p>
                  </>
                ) : (
                  <div className="ollama-setup">
                    <p>Ollama is not running. To use Ollama:</p>
                    <ol>
                      <li>Download from <a href="https://ollama.ai" target="_blank">ollama.ai</a></li>
                      <li>Run <code>ollama serve</code></li>
                      <li>Pull a model: <code>ollama pull llama3.2:1b</code></li>
                    </ol>
                    <button onClick={() => checkOllamaAvailable().then(setOllamaAvailable)}>
                      🔄 Check Again
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Custom Terms */}
            <section className="settings-section">
              <h3 className="section-title">📝 My Dictionary</h3>
              <p className="setting-description">Words to ignore (names, jargon, etc.)</p>

              <div className="custom-terms-input">
                <input
                  type="text"
                  placeholder="Add a word..."
                  value={customTermInput}
                  onChange={(e) => setCustomTermInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomTerm()}
                />
                <button onClick={addCustomTerm}>Add</button>
              </div>

              {settings.ai.customTerms.length > 0 && (
                <div className="custom-terms-list">
                  {settings.ai.customTerms.map((term) => (
                    <span key={term} className="custom-term">
                      {term}
                      <button onClick={() => removeCustomTerm(term)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Privacy Note */}
            <section className="settings-section privacy-section">
              <div className="privacy-badge">
                <span className="privacy-icon">🔒</span>
                <div>
                  <strong>100% Private</strong>
                  <span>All AI runs locally. Your text never leaves your device.</span>
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

