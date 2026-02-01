/**
 * LexiLens Content Script
 * Handles all DOM interactions including the Reading Ruler and Text Capture
 */

import { debounceWithCancel } from '../../utils/debounce';
import { analyzeText } from '../../utils/phonetic-engine';
import { loadSettings, onSettingsChange } from '../../utils/storage';
import { onContentMessage } from '../../utils/messages';
import type { LexiLensSettings, SpellingSuggestion, LexiLensMessage } from '../../types';
import './style.css';

// =============================================================================
// State
// =============================================================================

let settings: LexiLensSettings | null = null;
let rulerElement: HTMLDivElement | null = null;
let currentFocusedElement: HTMLElement | null = null;
let mutationObserver: MutationObserver | null = null;
let overlayContainer: HTMLDivElement | null = null;

// =============================================================================
// Content Script Definition
// =============================================================================

export default defineContentScript({
  matches: ['<all_urls>'],

  async main() {
    console.log('[LexiLens] Content script initialized');

    // Load initial settings
    settings = await loadSettings();

    // Initialize components based on settings
    if (settings.rulerEnabled) {
      initializeReadingRuler();
    }

    if (settings.correctionEnabled) {
      initializeTextCapture();
    }

    // Listen for settings changes
    onSettingsChange((newSettings) => {
      const prevSettings = settings;
      settings = newSettings;

      // Handle ruler toggle
      if (newSettings.rulerEnabled !== prevSettings?.rulerEnabled) {
        if (newSettings.rulerEnabled) {
          initializeReadingRuler();
        } else {
          destroyReadingRuler();
        }
      }

      // Update ruler appearance
      if (rulerElement) {
        updateRulerStyles();
      }

      // Handle correction toggle
      if (newSettings.correctionEnabled !== prevSettings?.correctionEnabled) {
        if (newSettings.correctionEnabled) {
          initializeTextCapture();
        } else {
          destroyTextCapture();
        }
      }
    });

    // Listen for messages from background
    onContentMessage(handleBackgroundMessage);
  },
});

// =============================================================================
// Reading Ruler
// =============================================================================

/**
 * Initialize the Reading Ruler component
 */
function initializeReadingRuler(): void {
  if (rulerElement) return; // Already initialized

  // Create the ruler element
  rulerElement = document.createElement('div');
  rulerElement.id = 'lexilens-reading-ruler';
  rulerElement.setAttribute('aria-hidden', 'true');

  // Apply initial styles
  updateRulerStyles();

  // Add to DOM
  document.body.appendChild(rulerElement);

  // Start tracking mouse
  document.addEventListener('mousemove', handleMouseMove, { passive: true });

  console.log('[LexiLens] Reading Ruler initialized');
}

/**
 * Update ruler styles based on current settings
 */
function updateRulerStyles(): void {
  if (!rulerElement || !settings) return;

  rulerElement.style.setProperty('--ruler-color', settings.rulerColor);
  rulerElement.style.setProperty('--ruler-opacity', settings.rulerOpacity.toString());
  rulerElement.style.setProperty('--ruler-height', `${settings.rulerHeight}px`);
}

/**
 * Handle mouse movement to position the ruler
 */
function handleMouseMove(event: MouseEvent): void {
  if (!rulerElement || !settings?.rulerEnabled) return;

  const rulerHeight = settings.rulerHeight;
  const y = event.clientY - rulerHeight / 2;

  // Use transform for better performance (GPU accelerated)
  rulerElement.style.transform = `translateY(${y}px)`;

  // Show ruler if hidden
  if (!rulerElement.classList.contains('visible')) {
    rulerElement.classList.add('visible');
  }
}

/**
 * Destroy the Reading Ruler component
 */
function destroyReadingRuler(): void {
  if (rulerElement) {
    document.removeEventListener('mousemove', handleMouseMove);
    rulerElement.remove();
    rulerElement = null;
    console.log('[LexiLens] Reading Ruler destroyed');
  }
}

// =============================================================================
// Text Capture (The "Eyes")
// =============================================================================

/**
 * Initialize text capture for input monitoring
 */
function initializeTextCapture(): void {
  // Create overlay container for highlights
  if (!overlayContainer) {
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'lexilens-overlay-container';
    overlayContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlayContainer);
  }

  // Listen for focus events to track active input
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);

  // Listen for input events on standard elements
  document.addEventListener('input', handleInput, true);

  console.log('[LexiLens] Text capture initialized');
}

/**
 * Destroy text capture
 */
function destroyTextCapture(): void {
  document.removeEventListener('focusin', handleFocusIn, true);
  document.removeEventListener('focusout', handleFocusOut, true);
  document.removeEventListener('input', handleInput, true);

  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
  }

  currentFocusedElement = null;
  debouncedAnalyze.cancel();

  console.log('[LexiLens] Text capture destroyed');
}

/**
 * Handle focus entering an element
 */
function handleFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement;

  if (isEditableElement(target)) {
    // Clean up previous observer
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    currentFocusedElement = target;

    // Set up MutationObserver for contenteditable elements
    if (target.isContentEditable) {
      mutationObserver = new MutationObserver(handleContentEditableMutation);
      mutationObserver.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    console.log('[LexiLens] Focus on editable element:', target.tagName);
  }
}

/**
 * Handle focus leaving an element
 */
function handleFocusOut(event: FocusEvent): void {
  const target = event.target as HTMLElement;

  if (target === currentFocusedElement) {
    // Cancel any pending analysis
    debouncedAnalyze.cancel();

    // Clean up observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    // Clear overlays
    clearOverlays();

    currentFocusedElement = null;
  }
}

/**
 * Handle input events on standard input/textarea elements
 */
function handleInput(event: Event): void {
  if (!settings?.correctionEnabled) return;

  const target = event.target as HTMLElement;

  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    const text = (target as HTMLInputElement | HTMLTextAreaElement).value;

    if (text.length > 3) {
      debouncedAnalyze(text, target);
    }
  }
}

/**
 * Handle mutations in contenteditable elements
 */
function handleContentEditableMutation(_mutations: MutationRecord[]): void {
  if (!settings?.correctionEnabled || !currentFocusedElement) return;

  // Get the current text content
  const text = currentFocusedElement.innerText || '';

  if (text.length > 3) {
    debouncedAnalyze(text, currentFocusedElement);
  }
}

/**
 * Check if an element is editable
 */
function isEditableElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toUpperCase();

  if (tagName === 'INPUT') {
    const inputType = (element as HTMLInputElement).type.toLowerCase();
    return ['text', 'search', 'email', 'url', 'tel'].includes(inputType);
  }

  if (tagName === 'TEXTAREA') {
    return true;
  }

  return element.isContentEditable;
}

// =============================================================================
// Text Analysis & Highlighting
// =============================================================================

/**
 * Debounced text analysis function
 * Waits 1000ms after typing stops before analyzing
 */
const debouncedAnalyze = debounceWithCancel(
  (text: string, element: HTMLElement) => {
    performAnalysis(text, element);
  },
  1000
);

/**
 * Perform text analysis and display suggestions
 */
function performAnalysis(text: string, element: HTMLElement): void {
  console.log('[LexiLens] Analyzing text:', text.substring(0, 50) + '...');

  const suggestions = analyzeText(text);

  if (suggestions.length > 0) {
    console.log('[LexiLens] Found suggestions:', suggestions);
    displaySuggestions(suggestions, element);
  } else {
    clearOverlays();
  }
}

/**
 * Display spelling suggestions as overlays
 */
function displaySuggestions(
  suggestions: SpellingSuggestion[],
  _element: HTMLElement
): void {
  clearOverlays();

  if (!overlayContainer) return;

  // For now, log suggestions - overlay positioning will be enhanced later
  suggestions.forEach((suggestion) => {
    console.log(
      `[LexiLens] "${suggestion.original}" → "${suggestion.suggestions[0]}" ` +
      `(${Math.round(suggestion.confidence * 100)}% confidence)`
    );

    // Create a tooltip notification for high-confidence suggestions
    if (suggestion.confidence > 0.8) {
      showSuggestionToast(suggestion);
    }
  });
}

/**
 * Show a toast notification for a suggestion
 */
function showSuggestionToast(suggestion: SpellingSuggestion): void {
  const toast = document.createElement('div');
  toast.className = 'lexilens-toast';
  toast.innerHTML = `
    <span class="lexilens-toast-icon">✨</span>
    <span class="lexilens-toast-text">
      Did you mean <strong>${suggestion.suggestions[0]}</strong> 
      instead of <em>${suggestion.original}</em>?
    </span>
  `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Clear all overlay highlights
 */
function clearOverlays(): void {
  if (overlayContainer) {
    overlayContainer.innerHTML = '';
  }

  // Remove any toasts
  document.querySelectorAll('.lexilens-toast').forEach((el) => el.remove());
}

// =============================================================================
// Message Handling
// =============================================================================

/**
 * Handle messages from the background script
 */
function handleBackgroundMessage(message: LexiLensMessage): void {
  switch (message.type) {
    case 'TOGGLE_RULER':
      if (message.payload !== undefined) {
        if (message.payload) {
          initializeReadingRuler();
        } else {
          destroyReadingRuler();
        }
      } else {
        // Toggle
        if (rulerElement) {
          destroyReadingRuler();
        } else {
          initializeReadingRuler();
        }
      }
      break;

    case 'SETTINGS_UPDATED':
      // Settings changes are handled by onSettingsChange listener
      break;

    case 'ANALYSIS_RESULT':
      // Handle AI analysis results
      if (currentFocusedElement && message.payload.suggestions.length > 0) {
        displaySuggestions(message.payload.suggestions, currentFocusedElement);
      }
      break;
  }
}

