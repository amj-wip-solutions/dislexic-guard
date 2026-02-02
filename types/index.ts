/**
 * LexiLens Type Definitions
 * Strict TypeScript interfaces for all data passed between scripts
 */

// =============================================================================
// User Settings
// =============================================================================

export type AIBackend = 'browser' | 'ollama';

export interface AIConfig {
  /** Which AI backend to use */
  backend: AIBackend;
  /** Selected browser model ID */
  browserModelId: string;
  /** Selected Ollama model ID */
  ollamaModelId: string;
  /** Ollama server endpoint */
  ollamaEndpoint: string;
  /** Custom terms to ignore */
  customTerms: string[];
  /** Whether model has been downloaded (for browser) */
  modelDownloaded: boolean;
}

export interface LexiLensSettings {
  /** Whether text correction/highlighting is enabled */
  correctionEnabled: boolean;
  /** Highlight color for errors */
  highlightColor: string;
  /** AI configuration */
  ai: AIConfig;
  /** Whether to apply OpenDyslexic font to web pages */
  dyslexicFontEnabled: boolean;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  backend: 'browser',
  browserModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  ollamaModelId: 'llama3.2:1b',
  ollamaEndpoint: 'http://localhost:11434',
  customTerms: [],
  modelDownloaded: false,
};

export const DEFAULT_SETTINGS: LexiLensSettings = {
  correctionEnabled: true,
  highlightColor: '#FF6B35',
  ai: DEFAULT_AI_CONFIG,
  dyslexicFontEnabled: false,
};

// =============================================================================
// Spelling & Correction Types
// =============================================================================

/**
 * Issue categories for different highlight colors:
 * - purple: High-stakes words (definite errors, click to see tip)
 * - yellow: Ambiguous/homophones (need context, user must choose meaning)
 * - blue: Names, acronyms, technical terms (verify correct)
 * - orange: Common typos and phonetic errors
 * - green: Suggestions/improvements (not errors)
 *
 * Extensible - add new categories as needed
 */
export type IssueCategory = 'purple' | 'yellow' | 'blue' | 'orange' | 'green' | string;

/**
 * Color configuration for each issue category
 */
export interface CategoryStyle {
  background: string;
  border: string;
  label: string;
  icon: string;
  description: string;
}

/**
 * Default category styles - can be extended
 */
export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  purple: {
    background: 'rgba(139, 92, 246, 0.2)',
    border: '#8B5CF6',
    label: 'High-Stakes',
    icon: '🔍',
    description: 'Definite error - click for memory tip',
  },
  yellow: {
    background: 'rgba(251, 191, 36, 0.2)',
    border: '#FBBF24',
    label: 'Ambiguous',
    icon: '⚠️',
    description: 'Has "evil twins" - choose the right meaning',
  },
  blue: {
    background: 'rgba(59, 130, 246, 0.2)',
    border: '#3B82F6',
    label: 'Verify',
    icon: '✓',
    description: 'Name/acronym - verify spelling',
  },
  orange: {
    background: 'rgba(249, 115, 22, 0.2)',
    border: '#F97316',
    label: 'Typo',
    icon: '✏️',
    description: 'Common typo or phonetic error',
  },
  green: {
    background: 'rgba(34, 197, 94, 0.2)',
    border: '#22C55E',
    label: 'Suggestion',
    icon: '💡',
    description: 'Optional improvement',
  },
};

export interface SpellingSuggestion {
  /** The original misspelled word */
  original: string;
  /** Array of suggested corrections, ordered by confidence */
  suggestions: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Source of the suggestion */
  source: 'local' | 'ai';
  /** Position in the original text */
  position: {
    start: number;
    end: number;
  };
  /** Category of issue for color-coded highlighting */
  category: IssueCategory;
  /** Optional tip or explanation */
  tip?: string;
}

export interface AnalysisResult {
  /** Original text that was analyzed */
  text: string;
  /** Array of spelling suggestions */
  suggestions: SpellingSuggestion[];
  /** Timestamp of analysis */
  timestamp: number;
}

// =============================================================================
// Message Types (Content <-> Background Communication)
// =============================================================================

export interface AnalyzeTextMessage {
  type: 'ANALYZE_TEXT';
  payload: {
    text: string;
    elementId?: string;
  };
}

export interface AnalysisResultMessage {
  type: 'ANALYSIS_RESULT';
  payload: AnalysisResult;
}

export interface SettingsUpdatedMessage {
  type: 'SETTINGS_UPDATED';
  payload: Partial<LexiLensSettings>;
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface SettingsResponseMessage {
  type: 'SETTINGS_RESPONSE';
  payload: LexiLensSettings;
}

export type LexiLensMessage =
  | AnalyzeTextMessage
  | AnalysisResultMessage
  | SettingsUpdatedMessage
  | GetSettingsMessage
  | SettingsResponseMessage;

