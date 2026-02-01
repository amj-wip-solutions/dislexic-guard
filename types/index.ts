/**
 * LexiLens Type Definitions
 * Strict TypeScript interfaces for all data passed between scripts
 */

// =============================================================================
// User Settings
// =============================================================================

export type BrowserModelId = 'phi-3-mini' | 'tinyllama' | 'smollm';

export interface BrowserAIConfig {
  /** Whether browser AI is enabled */
  enabled: boolean;
  /** Which model to use */
  modelId: BrowserModelId;
  /** Custom work-specific terms that should not be flagged */
  customTerms: string[];
}

export interface LexiLensSettings {
  /** Whether text correction/highlighting is enabled */
  correctionEnabled: boolean;
  /** Highlight color for errors */
  highlightColor: string;
  /** Browser AI configuration */
  browserAI: BrowserAIConfig;
}

export const DEFAULT_BROWSER_AI_CONFIG: BrowserAIConfig = {
  enabled: false,
  modelId: 'smollm', // Smallest model for fastest loading
  customTerms: [],
};

export const DEFAULT_SETTINGS: LexiLensSettings = {
  correctionEnabled: true,
  highlightColor: '#FF6B35',
  browserAI: DEFAULT_BROWSER_AI_CONFIG,
};

// =============================================================================
// Spelling & Correction Types
// =============================================================================

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

