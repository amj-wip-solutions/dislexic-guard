/**
 * LexiLens Local AI Integration
 * Uses Ollama (local LLM) for deeper dyslexia-aware text analysis
 *
 * Benefits:
 * - 100% free (runs on your machine)
 * - Privacy-first (text never leaves your device)
 * - Context-aware suggestions
 * - Can learn work-specific terms
 * - Catches proper name issues
 */

import type { SpellingSuggestion } from '../types';

// Ollama default endpoint (runs locally)
const OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';

// Default model - Mistral is fast and good at text tasks
const DEFAULT_MODEL = 'mistral';

export interface LocalAIConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  customTerms: string[]; // Work-specific terms to recognize
}

export const DEFAULT_AI_CONFIG: LocalAIConfig = {
  enabled: false,
  endpoint: OLLAMA_ENDPOINT,
  model: DEFAULT_MODEL,
  customTerms: [],
};

/**
 * Check if Ollama is running locally
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of available models from Ollama
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) return [];

    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Analyze text using local Ollama LLM
 * This provides deeper, context-aware analysis than the dictionary
 */
export async function analyzeWithLocalAI(
  text: string,
  config: LocalAIConfig
): Promise<SpellingSuggestion[]> {
  if (!config.enabled) return [];

  const customTermsContext = config.customTerms.length > 0
    ? `\n\nThe user has defined these custom terms that are CORRECT and should NOT be flagged: ${config.customTerms.join(', ')}`
    : '';

  const prompt = `You are a spelling assistant specialized in helping people with dyslexia.
Analyze the following text and identify spelling mistakes, focusing on:

1. DYSLEXIA PATTERNS:
   - Letter reversals (b/d, p/q, m/w)
   - Phonetic spellings (writing words how they sound)
   - Missing or extra letters
   - Double letter confusion

2. PROPER NAMES:
   - Flag names that look misspelled but might be intentional
   - Be careful with unusual but valid names

3. CONTEXT AWARENESS:
   - Consider the context to suggest the right word
   - "their" vs "there" vs "they're" based on usage
${customTermsContext}

TEXT TO ANALYZE:
"${text}"

Respond ONLY with a JSON array. For each issue found:
{
  "original": "the misspelled word",
  "suggestions": ["best suggestion", "alternative 1", "alternative 2"],
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation of why this was flagged"
}

If no issues found, return: []
Return ONLY valid JSON, no other text.`;

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower = more consistent
          num_predict: 500, // Limit response length
        },
      }),
    });

    if (!response.ok) {
      console.error('[LexiLens] Ollama request failed:', response.status);
      return [];
    }

    const data = await response.json();
    const responseText = data.response || '';

    // Extract JSON from response (Ollama sometimes adds extra text)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('[LexiLens] No JSON found in AI response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Convert to our SpellingSuggestion format and find positions
    return parsed.map((item: {
      original: string;
      suggestions: string[];
      confidence: number;
      reason?: string;
    }) => {
      const start = text.toLowerCase().indexOf(item.original.toLowerCase());
      return {
        original: item.original,
        suggestions: item.suggestions.slice(0, 3), // Max 3 suggestions
        confidence: Math.min(1, Math.max(0, item.confidence)),
        source: 'ai' as const,
        position: {
          start: start >= 0 ? start : 0,
          end: start >= 0 ? start + item.original.length : item.original.length,
        },
        // Store reason for UI
        _reason: item.reason,
      };
    }).filter((s: SpellingSuggestion) => s.position.start >= 0);

  } catch (error) {
    console.error('[LexiLens] Local AI analysis failed:', error);
    return [];
  }
}

/**
 * Quick check if text might benefit from AI analysis
 * (to avoid unnecessary API calls)
 */
export function shouldUseAI(text: string): boolean {
  // Use AI for longer texts where context matters
  if (text.length > 50) return true;

  // Use AI if text contains potential proper nouns (capitalized words mid-sentence)
  if (/\s[A-Z][a-z]+/.test(text)) return true;

  // Use AI if text contains homophones that need context
  const contextWords = ['their', 'there', 'they\'re', 'your', 'you\'re', 'its', 'it\'s', 'to', 'too', 'two'];
  if (contextWords.some(w => text.toLowerCase().includes(w))) return true;

  return false;
}

/**
 * Merge suggestions from local dictionary and AI, removing duplicates
 * AI suggestions take lower priority for words already caught by dictionary
 */
export function mergeSuggestions(
  localSuggestions: SpellingSuggestion[],
  aiSuggestions: SpellingSuggestion[]
): SpellingSuggestion[] {
  const seen = new Map<string, SpellingSuggestion>();

  // Local suggestions first (they're instant and reliable)
  for (const suggestion of localSuggestions) {
    const key = suggestion.original.toLowerCase();
    seen.set(key, suggestion);
  }

  // Add AI suggestions that aren't duplicates (or merge if more confident)
  for (const suggestion of aiSuggestions) {
    const key = suggestion.original.toLowerCase();
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, suggestion);
    } else if (suggestion.confidence > existing.confidence) {
      // AI found same word with higher confidence - use AI's suggestions
      seen.set(key, {
        ...existing,
        suggestions: suggestion.suggestions,
        confidence: suggestion.confidence,
        source: 'ai',
      });
    }
  }

  return Array.from(seen.values());
}

