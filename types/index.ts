/**
 * LexiLens Type Definitions
 * Strict TypeScript interfaces for all data passed between scripts
 */

// =============================================================================
// User Settings
// =============================================================================

export interface LexiLensSettings {
  /** Whether the reading ruler is enabled */
  rulerEnabled: boolean;
  /** Ruler band color (CSS color value) */
  rulerColor: string;
  /** Ruler opacity (0-1) */
  rulerOpacity: number;
  /** Ruler height in pixels */
  rulerHeight: number;
  /** Whether text correction is enabled */
  correctionEnabled: boolean;
  /** AI provider for advanced corrections */
  aiProvider: 'openai' | 'local' | 'none';
  /** API key for AI provider (stored securely) */
  apiKey?: string;
}

export const DEFAULT_SETTINGS: LexiLensSettings = {
  rulerEnabled: true,
  rulerColor: '#FFE4B5', // Moccasin - dyslexia-friendly warm color
  rulerOpacity: 0.4,
  rulerHeight: 40,
  correctionEnabled: true,
  aiProvider: 'local',
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

export interface ToggleRulerMessage {
  type: 'TOGGLE_RULER';
  payload?: boolean;
}

export type LexiLensMessage =
  | AnalyzeTextMessage
  | AnalysisResultMessage
  | SettingsUpdatedMessage
  | GetSettingsMessage
  | SettingsResponseMessage
  | ToggleRulerMessage;

// =============================================================================
// DOM & UI Types
// =============================================================================

export interface WordPosition {
  /** The word text */
  word: string;
  /** Bounding rectangle relative to viewport */
  rect: DOMRect;
  /** Index in original text */
  index: number;
}

export interface OverlayHighlight {
  /** Unique identifier for this highlight */
  id: string;
  /** The DOM element used for the overlay */
  element: HTMLElement;
  /** Associated spelling suggestion */
  suggestion: SpellingSuggestion;
}

// =============================================================================
// Event Types
// =============================================================================

export interface TextChangeEvent {
  /** The element that changed */
  element: HTMLElement;
  /** Current text content */
  text: string;
  /** Type of element */
  elementType: 'input' | 'textarea' | 'contenteditable';
}

