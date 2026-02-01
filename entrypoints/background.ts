/**
 * LexiLens Background Service Worker
 * Handles message routing and settings management
 * Note: Browser AI runs in content script (needs DOM access for WebGPU)
 */

import { loadSettings, updateSettings } from '../utils/storage';
import { analyzeText } from '../utils/phonetic-engine';
import { onMessage, broadcastSettingsUpdate } from '../utils/messages';
import type {
  LexiLensMessage,
  AnalysisResult,
  LexiLensSettings,
  SpellingSuggestion
} from '../types';

// =============================================================================
// Background Script Definition
// =============================================================================

export default defineBackground(() => {
  console.log('[LexiLens] Background service worker started');

  // Set up message listener
  setupMessageHandler();

  // Initialize settings on install
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      console.log('[LexiLens] Extension installed, initializing settings');
      await loadSettings();
    }
  });
});

// =============================================================================
// Message Handling
// =============================================================================

function setupMessageHandler(): void {
  onMessage(async (message: LexiLensMessage, _sender) => {
    console.log('[LexiLens] Received message:', message.type);

    switch (message.type) {
      case 'ANALYZE_TEXT':
        return handleAnalyzeText(message.payload.text);

      case 'GET_SETTINGS':
        return loadSettings();

      case 'SETTINGS_UPDATED':
        return handleSettingsUpdate(message.payload);

      default:
        console.warn('[LexiLens] Unknown message type:', (message as LexiLensMessage).type);
        return null;
    }
  });
}

/**
 * Handle text analysis request (local dictionary only)
 * Browser AI is handled in the content script for WebGPU access
 */
async function handleAnalyzeText(text: string): Promise<AnalysisResult> {
  const timestamp = Date.now();

  // Get local dictionary suggestions (instant)
  const localSuggestions = analyzeText(text);
  console.log('[LexiLens] Local suggestions:', localSuggestions.length);

  return {
    text,
    suggestions: localSuggestions,
    timestamp,
  };
}

/**
 * Handle settings update
 */
async function handleSettingsUpdate(
  partial: Partial<LexiLensSettings>
): Promise<LexiLensSettings> {
  const updated = await updateSettings(partial);

  // Broadcast to all content scripts
  await broadcastSettingsUpdate(partial);

  return updated;
}

