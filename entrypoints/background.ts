/**
 * LexiLens Background Service Worker
 * Handles AI processing, storage management, and messaging
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

  // Set up keyboard shortcut listener
  setupCommandListener();

  // Initialize settings on install
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      console.log('[LexiLens] Extension installed, initializing settings');
      await loadSettings(); // This will create defaults if not exist
    }
  });
});

// =============================================================================
// Message Handling
// =============================================================================

function setupMessageHandler(): void {
  onMessage(async (message: LexiLensMessage, sender) => {
    console.log('[LexiLens] Received message:', message.type);

    switch (message.type) {
      case 'ANALYZE_TEXT':
        return handleAnalyzeText(message.payload.text);

      case 'GET_SETTINGS':
        return loadSettings();

      case 'SETTINGS_UPDATED':
        return handleSettingsUpdate(message.payload);

      case 'TOGGLE_RULER':
        return handleToggleRuler(message.payload);

      default:
        console.warn('[LexiLens] Unknown message type:', (message as LexiLensMessage).type);
        return null;
    }
  });
}

/**
 * Handle text analysis request
 * Combines local dictionary with optional AI analysis
 */
async function handleAnalyzeText(text: string): Promise<AnalysisResult> {
  const timestamp = Date.now();

  // First, get local suggestions (instant)
  const localSuggestions = analyzeText(text);

  // Get settings to check if AI is enabled
  const settings = await loadSettings();

  let allSuggestions: SpellingSuggestion[] = [...localSuggestions];

  // If AI is enabled and configured, get AI suggestions
  if (settings.aiProvider !== 'none' && settings.apiKey) {
    try {
      const aiSuggestions = await getAISuggestions(text, settings);
      allSuggestions = mergeSuggestions(localSuggestions, aiSuggestions);
    } catch (error) {
      console.error('[LexiLens] AI analysis failed:', error);
      // Continue with local suggestions only
    }
  }

  return {
    text,
    suggestions: allSuggestions,
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

/**
 * Handle ruler toggle
 */
async function handleToggleRuler(
  enabled?: boolean
): Promise<LexiLensSettings> {
  const current = await loadSettings();
  const newEnabled = enabled ?? !current.rulerEnabled;

  return handleSettingsUpdate({ rulerEnabled: newEnabled });
}

// =============================================================================
// AI Integration (Prepared for OpenAI/Local LLM)
// =============================================================================

/**
 * Get AI-powered spelling suggestions
 * Prioritizes phonetic similarity over edit distance
 */
async function getAISuggestions(
  text: string,
  settings: LexiLensSettings
): Promise<SpellingSuggestion[]> {
  if (settings.aiProvider === 'openai' && settings.apiKey) {
    return callOpenAI(text, settings.apiKey);
  }

  if (settings.aiProvider === 'local') {
    return callLocalLLM(text);
  }

  return [];
}

/**
 * Call OpenAI API for spelling suggestions
 */
async function callOpenAI(
  text: string,
  apiKey: string
): Promise<SpellingSuggestion[]> {
  const systemPrompt = `You are a spelling assistant specialized in helping people with dyslexia. 
Your task is to identify misspelled words and suggest corrections.

IMPORTANT: Prioritize phonetic similarity over literal spelling distance.
People with dyslexia often write words as they sound, not as they're spelled.

For each misspelled word, return a JSON array with:
- "original": the misspelled word
- "suggestions": array of up to 3 correct spellings, most likely first
- "confidence": number from 0 to 1

Only return the JSON array, no other text. If no corrections needed, return [].`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Check this text for spelling: "${text}"` },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) return [];

    // Parse the JSON response
    const parsed = JSON.parse(content);

    return parsed.map((item: { original: string; suggestions: string[]; confidence: number }, index: number) => ({
      original: item.original,
      suggestions: item.suggestions,
      confidence: item.confidence,
      source: 'ai' as const,
      position: { start: text.indexOf(item.original), end: text.indexOf(item.original) + item.original.length },
    }));
  } catch (error) {
    console.error('[LexiLens] OpenAI call failed:', error);
    return [];
  }
}

/**
 * Call local LLM for spelling suggestions
 * Placeholder for future local AI integration (e.g., Ollama)
 */
async function callLocalLLM(text: string): Promise<SpellingSuggestion[]> {
  // TODO: Implement local LLM integration
  // For now, return empty array (local dictionary is used instead)
  return [];
}

/**
 * Merge local and AI suggestions, removing duplicates
 */
function mergeSuggestions(
  local: SpellingSuggestion[],
  ai: SpellingSuggestion[]
): SpellingSuggestion[] {
  const seen = new Set<string>();
  const merged: SpellingSuggestion[] = [];

  // Local suggestions take priority (they're instant and reliable)
  for (const suggestion of local) {
    seen.add(suggestion.original.toLowerCase());
    merged.push(suggestion);
  }

  // Add AI suggestions that aren't duplicates
  for (const suggestion of ai) {
    if (!seen.has(suggestion.original.toLowerCase())) {
      merged.push(suggestion);
    }
  }

  return merged;
}

// =============================================================================
// Keyboard Shortcuts
// =============================================================================

function setupCommandListener(): void {
  chrome.commands.onCommand.addListener(async (command) => {
    console.log('[LexiLens] Command received:', command);

    switch (command) {
      case 'toggle-ruler':
        await handleToggleRuler();
        break;

      case 'toggle-extension':
        // Toggle both ruler and corrections
        const settings = await loadSettings();
        const newEnabled = !settings.rulerEnabled || !settings.correctionEnabled;
        await handleSettingsUpdate({
          rulerEnabled: newEnabled,
          correctionEnabled: newEnabled,
        });
        break;
    }
  });
}


