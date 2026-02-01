/**
 * LexiLens Browser AI Integration
 * Uses WebLLM to run a small, specialized model directly in the browser
 *
 * Benefits:
 * - No separate install (runs in browser)
 * - Uses WebGPU for acceleration
 * - Small model (~500MB) specialized for spelling
 * - 100% private - never leaves your device
 */

import type { SpellingSuggestion } from '../types';

// We'll use a small model optimized for text correction
// Phi-3-mini or TinyLlama are good choices (~500MB-1GB)
const SUPPORTED_MODELS = {
  'phi-3-mini': {
    id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
    name: 'Phi-3 Mini (recommended)',
    size: '~1.4GB',
    speed: 'fast',
  },
  'tinyllama': {
    id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
    name: 'TinyLlama (smaller)',
    size: '~600MB',
    speed: 'very fast',
  },
  'smollm': {
    id: 'SmolLM-135M-Instruct-q4f16_1-MLC',
    name: 'SmolLM (tiny)',
    size: '~100MB',
    speed: 'instant',
  },
} as const;

export type BrowserModelId = keyof typeof SUPPORTED_MODELS;

export interface BrowserAIConfig {
  enabled: boolean;
  modelId: BrowserModelId;
  customTerms: string[];
  isLoaded: boolean;
  loadProgress: number;
}

export const DEFAULT_BROWSER_AI_CONFIG: BrowserAIConfig = {
  enabled: false,
  modelId: 'smollm', // Start with smallest for fast loading
  customTerms: [],
  isLoaded: false,
  loadProgress: 0,
};

// Global engine instance (persists across calls)
let engineInstance: WebLLMEngine | null = null;
let currentModelId: string | null = null;

/**
 * Lightweight WebLLM engine wrapper
 */
interface WebLLMEngine {
  chat: {
    completions: {
      create: (params: {
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        max_tokens?: number;
      }) => Promise<{ choices: Array<{ message: { content: string } }> }>;
    };
  };
}

/**
 * Check if WebGPU is available in this browser
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!('gpu' in navigator)) return false;

  try {
    const adapter = await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Initialize the WebLLM engine with the selected model
 * This downloads the model on first use (~100MB-1.4GB depending on model)
 */
export async function initializeBrowserAI(
  modelId: BrowserModelId | undefined,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  // Default to smallest model if not specified
  const safeModelId: BrowserModelId = modelId && modelId in SUPPORTED_MODELS ? modelId : 'smollm';

  // Check if already loaded with same model
  if (engineInstance && currentModelId === safeModelId) {
    return true;
  }

  try {
    // Dynamic import of WebLLM (only load when needed)
    const webllm = await import('@mlc-ai/web-llm');

    const modelConfig = SUPPORTED_MODELS[safeModelId];

    if (!modelConfig || !modelConfig.id) {
      console.error('[LexiLens AI] Invalid model config for:', safeModelId);
      return false;
    }

    console.log('[LexiLens AI] Loading model:', modelConfig.id);

    // Create engine with progress callback
    const engine = await webllm.CreateMLCEngine(modelConfig.id, {
      initProgressCallback: (report: { progress: number; text: string }) => {
        console.log(`[LexiLens AI] ${report.text}`);
        onProgress?.(report.progress);
      },
    });

    engineInstance = engine as unknown as WebLLMEngine;
    currentModelId = safeModelId;

    console.log('[LexiLens AI] Model loaded successfully');
    return true;
  } catch (error) {
    console.error('[LexiLens AI] Failed to initialize:', error);
    return false;
  }
}

/**
 * Unload the model to free memory
 */
export function unloadBrowserAI(): void {
  engineInstance = null;
  currentModelId = null;
}

/**
 * Analyze text using the browser-based AI model
 */
export async function analyzeWithBrowserAI(
  text: string,
  config: BrowserAIConfig
): Promise<SpellingSuggestion[]> {
  if (!config.enabled || !engineInstance) {
    return [];
  }

  const customTermsNote = config.customTerms.length > 0
    ? `\nIgnore these terms (they are correct): ${config.customTerms.join(', ')}`
    : '';

  // Optimized prompt for small models - be very specific and concise
  const systemPrompt = `You find spelling mistakes for dyslexic users.
Focus on:
- Phonetic errors (frend→friend, sed→said)
- Letter swaps (b/d, p/q)  
- Missing/extra letters
- Wrong homophones (their/there)
${customTermsNote}

Reply ONLY with JSON array:
[{"word":"misspelled","fix":"correct","conf":0.9}]
Empty array [] if no errors.`;

  const userPrompt = `Check: "${text}"`;

  try {
    const response = await engineInstance.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Very low for consistent output
      max_tokens: 200, // Keep response short
    });

    const content = response.choices[0]?.message?.content || '[]';

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Convert to our format
    return parsed.map((item: { word: string; fix: string; conf: number }) => {
      const start = text.toLowerCase().indexOf(item.word.toLowerCase());
      if (start === -1) return null;

      return {
        original: item.word,
        suggestions: [item.fix],
        confidence: Math.min(1, Math.max(0, item.conf || 0.8)),
        source: 'ai' as const,
        position: {
          start,
          end: start + item.word.length,
        },
      };
    }).filter(Boolean) as SpellingSuggestion[];

  } catch (error) {
    console.error('[LexiLens AI] Analysis failed:', error);
    return [];
  }
}

/**
 * Quick check if text might benefit from AI analysis
 */
export function shouldUseBrowserAI(text: string): boolean {
  // Only use AI for texts that need context
  if (text.length < 20) return false;
  if (text.length > 500) return true; // Long text needs context

  // Check for homophones that need context
  const contextWords = ['their', 'there', "they're", 'your', "you're", 'its', "it's", 'to', 'too', 'two', 'then', 'than'];
  if (contextWords.some(w => text.toLowerCase().includes(w))) return true;

  // Check for capitalized words (potential proper nouns)
  if (/\s[A-Z][a-z]{2,}/.test(text)) return true;

  return false;
}

/**
 * Get info about supported models
 */
export function getSupportedModels() {
  return Object.entries(SUPPORTED_MODELS).map(([id, info]) => ({
    id: id as BrowserModelId,
    ...info,
  }));
}

/**
 * Check if model is currently loaded
 */
export function isModelLoaded(modelId?: BrowserModelId): boolean {
  if (!modelId) return engineInstance !== null;
  return currentModelId === modelId;
}

