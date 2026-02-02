/**
 * LexiLens Content Script
 * Dyslexia-focused spelling assistant with AI-powered suggestions
 *
 * Key fixes for highlight accuracy:
 * 1. Text versioning - ignore stale AI results
 * 2. Fuzzy word matching - search around hint position
 * 3. Accurate CSS mirroring for input/textarea
 * 4. Stable highlight updates on scroll (reposition, don't re-render)
 */

import { debounceWithCancel } from '../../utils/debounce';
import { analyzeText as analyzeTextLocal } from '../../utils/phonetic-engine';
import { loadSettings, onSettingsChange } from '../../utils/storage';
import { onContentMessage } from '../../utils/messages';
import type { LexiLensSettings, SpellingSuggestion, LexiLensMessage } from '../../types';
import './style.css';

// AI engine module - lazily loaded
let aiEngineModule: typeof import('../../utils/ai-engine') | null = null;

// =============================================================================
// State
// =============================================================================

let settings: LexiLensSettings | null = null;
let currentFocusedElement: HTMLElement | null = null;
let highlightContainer: HTMLDivElement | null = null;
let suggestionPopup: HTMLDivElement | null = null;
let currentSuggestions: SpellingSuggestion[] = [];
let activeHighlights: Map<string, { element: HTMLDivElement; suggestion: SpellingSuggestion }> = new Map();
let aiReady = false;

// Text versioning to handle stale AI results
let analysisVersion = 0;
let lastAnalyzedText = '';

// Track currently shown popup for toggle behavior
let currentPopupWord: string | null = null;
let isShowingPopup = false; // Prevent immediate closing after showing

// =============================================================================
// Content Script Definition
// =============================================================================

export default defineContentScript({
  matches: ['<all_urls>'],

  async main() {
    console.log('[LexiLens] Content script initialized');

    settings = await loadSettings();

    if (settings.correctionEnabled) {
      initializeHighlightSystem();
    }

    // Apply dyslexic font if enabled
    if (settings.dyslexicFontEnabled) {
      enableDyslexicFont();
    }

    initAIEngine();

    onSettingsChange((newSettings) => {
      const prevSettings = settings;
      settings = newSettings;

      if (newSettings.correctionEnabled !== prevSettings?.correctionEnabled) {
        if (newSettings.correctionEnabled) {
          initializeHighlightSystem();
        } else {
          destroyHighlightSystem();
        }
      }

      // Handle dyslexic font toggle
      if (newSettings.dyslexicFontEnabled !== prevSettings?.dyslexicFontEnabled) {
        if (newSettings.dyslexicFontEnabled) {
          enableDyslexicFont();
        } else {
          disableDyslexicFont();
        }
      }

      if (JSON.stringify(newSettings.ai) !== JSON.stringify(prevSettings?.ai)) {
        initAIEngine();
      }
    });

    onContentMessage(handleBackgroundMessage);
  },
});

// =============================================================================
// Dyslexic Font
// =============================================================================

function injectFontFaces(): void {
  // Check if already injected
  if (document.getElementById('lexilens-font-faces')) return;

  const style = document.createElement('style');
  style.id = 'lexilens-font-faces';

  // Get font URLs from extension
  const regularFontUrl = browser.runtime.getURL('fonts/OpenDyslexic-Regular.otf');
  const boldFontUrl = browser.runtime.getURL('fonts/OpenDyslexic-Bold.otf');

  style.textContent = `
    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${regularFontUrl}') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${boldFontUrl}') format('opentype');
      font-weight: bold;
      font-style: normal;
      font-display: swap;
    }
  `;

  document.head.appendChild(style);
  console.log('[LexiLens] Font faces injected');
}

function enableDyslexicFont(): void {
  injectFontFaces(); // Ensure fonts are loaded
  document.documentElement.classList.add('lexilens-dyslexic-font');
  console.log('[LexiLens] Dyslexic font enabled');
}

function disableDyslexicFont(): void {
  document.documentElement.classList.remove('lexilens-dyslexic-font');
  console.log('[LexiLens] Dyslexic font disabled');
}

// =============================================================================
// AI Engine Initialization
// =============================================================================

async function initAIEngine(): Promise<void> {
  if (!settings) {
    console.log('[LexiLens AI Init] ❌ No settings available');
    return;
  }

  console.log('[LexiLens AI Init] ========== AI INITIALIZATION ==========');
  console.log('[LexiLens AI Init] Backend:', settings.ai.backend);
  console.log('[LexiLens AI Init] Settings:', JSON.stringify(settings.ai, null, 2));

  if (!aiEngineModule) {
    try {
      console.log('[LexiLens AI Init] Loading AI engine module...');
      aiEngineModule = await import('../../utils/ai-engine');
      console.log('[LexiLens AI Init] ✅ AI engine module loaded');
    } catch (e) {
      console.error('[LexiLens AI Init] ❌ Failed to load AI engine:', e);
      return;
    }
  }

  if (settings.ai.backend === 'browser') {
    console.log('[LexiLens AI Init] → Using Browser AI');
    console.log('[LexiLens AI Init] Model ID:', settings.ai.browserModelId);
    console.log('[LexiLens AI Init] Model downloaded:', settings.ai.modelDownloaded);

    if (!settings.ai.modelDownloaded) {
      console.log('[LexiLens AI Init] ⚠️  Browser AI model not downloaded yet');
      aiReady = false;
      return;
    }

    console.log('[LexiLens AI Init] Checking WebGPU support...');
    const hasWebGPU = await aiEngineModule.checkWebGPUSupport();
    console.log('[LexiLens AI Init] WebGPU supported:', hasWebGPU);

    if (!hasWebGPU) {
      console.log('[LexiLens AI Init] ❌ WebGPU not supported - AI unavailable');
      aiReady = false;
      return;
    }

    console.log('[LexiLens AI Init] Initializing browser AI with model:', settings.ai.browserModelId);
    const success = await aiEngineModule.initBrowserAI(settings.ai.browserModelId);
    aiReady = success;

    if (success) {
      console.log('[LexiLens AI Init] ✅ Browser AI ready and operational');
      console.log('[LexiLens AI Init] Model:', settings.ai.browserModelId);
    } else {
      console.log('[LexiLens AI Init] ❌ Browser AI initialization failed');
    }
  } else {
    console.log('[LexiLens AI Init] → Using Ollama');
    console.log('[LexiLens AI Init] Endpoint:', settings.ai.ollamaEndpoint);
    console.log('[LexiLens AI Init] Model:', settings.ai.ollamaModelId);

    console.log('[LexiLens AI Init] Checking Ollama availability...');
    const available = await aiEngineModule.checkOllamaAvailable(settings.ai.ollamaEndpoint);
    aiReady = available;

    if (available) {
      console.log('[LexiLens AI Init] ✅ Ollama is available');
      console.log('[LexiLens AI Init] Endpoint:', settings.ai.ollamaEndpoint);
      console.log('[LexiLens AI Init] Model:', settings.ai.ollamaModelId);
    } else {
      console.log('[LexiLens AI Init] ❌ Ollama not available at', settings.ai.ollamaEndpoint);
    }
  }

  console.log('[LexiLens AI Init] Custom terms:', settings.ai.customTerms);
  console.log('[LexiLens AI Init] Final AI Status:', aiReady ? '✅ READY' : '❌ NOT READY');
  console.log('[LexiLens AI Init] ========================================');
}

// =============================================================================
// Highlight System Setup
// =============================================================================

function initializeHighlightSystem(): void {
  if (!highlightContainer) {
    highlightContainer = document.createElement('div');
    highlightContainer.id = 'lexilens-highlight-container';
    highlightContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(highlightContainer);
  }

  if (!suggestionPopup) {
    suggestionPopup = document.createElement('div');
    suggestionPopup.id = 'lexilens-suggestion-popup';
    suggestionPopup.setAttribute('role', 'dialog');
    document.body.appendChild(suggestionPopup);
  }

  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('paste', handlePaste, true);
  document.addEventListener('scroll', handleScroll, true);
  document.addEventListener('click', handleDocumentClick, true);
  window.addEventListener('resize', handleResize);

  console.log('[LexiLens] Highlight system initialized');
}

function destroyHighlightSystem(): void {
  document.removeEventListener('focusin', handleFocusIn, true);
  document.removeEventListener('focusout', handleFocusOut, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('paste', handlePaste, true);
  document.removeEventListener('scroll', handleScroll, true);
  document.removeEventListener('click', handleDocumentClick, true);
  window.removeEventListener('resize', handleResize);

  clearAllHighlights();

  if (highlightContainer) {
    highlightContainer.remove();
    highlightContainer = null;
  }

  if (suggestionPopup) {
    suggestionPopup.remove();
    suggestionPopup = null;
  }

  currentFocusedElement = null;
  debouncedAnalyze.cancel();
  console.log('[LexiLens] Highlight system destroyed');
}

// =============================================================================
// Event Handlers
// =============================================================================

function handleFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement;

  if (isEditableElement(target)) {
    currentFocusedElement = target;
    console.log('[LexiLens] Focused on editable:', target.tagName);

    const text = getElementText(target);
    if (text.length > 2) {
      debouncedAnalyze(text, target);
    }
  }
}

function handleFocusOut(event: FocusEvent): void {
  const target = event.target as HTMLElement;
  const relatedTarget = event.relatedTarget as HTMLElement | null;

  if (relatedTarget) {
    if (suggestionPopup?.contains(relatedTarget) || highlightContainer?.contains(relatedTarget)) {
      return;
    }
  }

  setTimeout(() => {
    if (target === currentFocusedElement && document.activeElement !== currentFocusedElement) {
      clearAllHighlights();
      hideSuggestionPopup();
      currentFocusedElement = null;
      lastAnalyzedText = '';
      debouncedAnalyze.cancel();
    }
  }, 300);
}

function handleInput(event: Event): void {
  if (!settings?.correctionEnabled) return;

  const target = event.target as HTMLElement;

  if (isEditableElement(target)) {
    const text = getElementText(target);
    hideSuggestionPopup();

    if (text.length > 2) {
      debouncedAnalyze(text, target);
    } else {
      clearAllHighlights();
      lastAnalyzedText = '';
    }
  }
}

function handlePaste(event: ClipboardEvent): void {
  if (!settings?.correctionEnabled) return;

  const target = event.target as HTMLElement;

  if (isEditableElement(target)) {
    clearAllHighlights();
    hideSuggestionPopup();

    setTimeout(() => {
      const text = getElementText(target);
      if (text.length > 2) {
        performAnalysis(text, target);
      }
    }, 100);
  }
}

function handleScroll(): void {
  // Only reposition existing highlights, don't re-render
  if (currentFocusedElement && activeHighlights.size > 0) {
    repositionHighlights();
  }
  hideSuggestionPopup();
}

function handleResize(): void {
  if (currentFocusedElement && activeHighlights.size > 0) {
    repositionHighlights();
  }
}

function handleDocumentClick(event: MouseEvent): void {
  // If we're currently showing the popup, ignore this click
  if (isShowingPopup) {
    isShowingPopup = false;
    return;
  }

  const target = event.target as HTMLElement;

  // CRITICAL: Check in order of precedence

  // 1. If clicking inside the popup itself, do nothing
  if (suggestionPopup && suggestionPopup.contains(target)) {
    return;
  }

  // 2. If clicking on a highlight, let the highlight handle it (don't close)
  const clickedHighlight = target.closest('.lexilens-highlight');
  if (clickedHighlight) {
    return;
  }

  // 3. Any other click outside popup/highlights - close popup
  if (suggestionPopup?.classList.contains('visible')) {
    hideSuggestionPopup();
  }
}

// =============================================================================
// Text Analysis with Versioning
// =============================================================================

const debouncedAnalyze = debounceWithCancel(
  (text: string, element: HTMLElement) => {
    performAnalysis(text, element);
  },
  500
);

async function performAnalysis(text: string, element: HTMLElement): Promise<void> {
  // Skip if text hasn't changed
  if (text === lastAnalyzedText) {
    console.log('[LexiLens Analysis] ⏭️  Text unchanged, skipping analysis');
    return;
  }

  // Increment version and capture snapshot
  const thisVersion = ++analysisVersion;
  const textSnapshot = text;
  lastAnalyzedText = text;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[LexiLens Analysis] 📝 ANALYSIS START v' + thisVersion);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[LexiLens Analysis] Element:', element.tagName, element.id ? `#${element.id}` : '');
  console.log('[LexiLens Analysis] Text length:', text.length, 'chars');
  console.log('[LexiLens Analysis] Full text:', `"${text}"`);
  console.log('[LexiLens Analysis] AI Ready:', aiReady ? '✅ YES' : '❌ NO');
  console.log('[LexiLens Analysis] AI Backend:', settings?.ai?.backend || 'none');

  let suggestions: SpellingSuggestion[] = [];

  // Try AI first
  if (aiReady && aiEngineModule && settings) {
    console.log('[LexiLens Analysis] 🤖 Using AI for analysis...');
    console.log('[LexiLens Analysis] AI Model:', settings.ai.backend === 'browser' ? settings.ai.browserModelId : settings.ai.ollamaModelId);

    try {
      const startTime = performance.now();
      suggestions = await aiEngineModule.analyzeWithAI(text, settings.ai);
      const duration = (performance.now() - startTime).toFixed(0);

      console.log('[LexiLens Analysis] ✅ AI analysis completed in', duration, 'ms');
      console.log('[LexiLens Analysis] AI found', suggestions.length, 'issues');

      if (suggestions.length > 0) {
        console.log('[LexiLens Analysis] ━━━ AI SUGGESTIONS ━━━');
        suggestions.forEach((s, i) => {
          console.log(`[LexiLens Analysis] ${i + 1}. Word: "${s.original}"`);
          console.log(`   → Suggestion: "${s.suggestions[0]}"`);
          console.log(`   → Category: ${s.category} (${getCategoryName(s.category)})`);
          console.log(`   → Position: chars ${s.position.start}-${s.position.end}`);
          console.log(`   → Context: "${text.substring(Math.max(0, s.position.start - 10), s.position.start)}[${s.original}]${text.substring(s.position.end, Math.min(text.length, s.position.end + 10))}"`);
          console.log(`   → Tip: ${s.tip || 'none'}`);
          console.log(`   → Confidence: ${s.confidence}`);
          console.log(`   → Source: ${s.source}`);
        });
      }
    } catch (error) {
      console.error('[LexiLens Analysis] ❌ AI failed:', error);
      console.error('[LexiLens Analysis] Error details:', error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log('[LexiLens Analysis] ⚠️  AI NOT available, reason:');
    console.log('   - aiReady:', aiReady);
    console.log('   - aiEngineModule loaded:', !!aiEngineModule);
    console.log('   - settings present:', !!settings);
    if (settings?.ai) {
      console.log('   - Backend:', settings.ai.backend);
      if (settings.ai.backend === 'browser') {
        console.log('   - Model downloaded:', settings.ai.modelDownloaded);
      }
    }
  }

  // Fallback to local if AI didn't find anything or isn't ready
  if (suggestions.length === 0) {
    console.log('[LexiLens Analysis] 📚 Using LOCAL dictionary fallback...');
    const startTime = performance.now();
    suggestions = analyzeTextLocal(text);
    const duration = (performance.now() - startTime).toFixed(0);

    console.log('[LexiLens Analysis] ✅ Local analysis completed in', duration, 'ms');
    console.log('[LexiLens Analysis] Local found', suggestions.length, 'issues');

    if (suggestions.length > 0) {
      console.log('[LexiLens Analysis] ━━━ LOCAL SUGGESTIONS ━━━');
      suggestions.forEach((s, i) => {
        console.log(`[LexiLens Analysis] ${i + 1}. "${s.original}" → "${s.suggestions[0]}" [${s.category}]`);
      });
    }
  }

  // *** CRITICAL: Check if text changed during analysis ***
  const currentText = getElementText(element);
  if (thisVersion !== analysisVersion) {
    console.log('[LexiLens Analysis] ⚠️  Version mismatch! Current:', analysisVersion, 'This:', thisVersion);
    console.log('[LexiLens Analysis] ❌ DISCARDING stale results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }

  if (currentText !== textSnapshot) {
    console.log('[LexiLens Analysis] ⚠️  Text changed during analysis!');
    console.log('[LexiLens Analysis] Original:', `"${textSnapshot.substring(0, 50)}..."`);
    console.log('[LexiLens Analysis] Current:', `"${currentText.substring(0, 50)}..."`);
    console.log('[LexiLens Analysis] ❌ DISCARDING stale results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }

  currentSuggestions = suggestions;

  if (suggestions.length > 0) {
    console.log('[LexiLens Analysis] 🎨 Rendering', suggestions.length, 'highlights...');
    renderHighlights(suggestions, element);
  } else {
    console.log('[LexiLens Analysis] ✨ No issues found - text is clean!');
    clearAllHighlights();
  }

  console.log('[LexiLens Analysis] ✅ ANALYSIS COMPLETE v' + thisVersion);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    purple: 'Spelling Error',
    yellow: 'Homophone/Evil Twin',
    blue: 'Name/Acronym Check',
    orange: 'Common Typo',
    green: 'Suggestion'
  };
  return names[category] || 'Unknown';
}

// =============================================================================
// Highlight Rendering
// =============================================================================

function renderHighlights(suggestions: SpellingSuggestion[], element: HTMLElement): void {
  clearAllHighlights();

  if (!highlightContainer) {
    console.error('[LexiLens Highlight] ❌ No highlight container!');
    return;
  }

  const text = getElementText(element);
  const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';

  console.log('\n[LexiLens Highlight] ━━━━━━━━ RENDERING HIGHLIGHTS ━━━━━━━━');
  console.log('[LexiLens Highlight] Element type:', isInput ? 'INPUT/TEXTAREA' : 'CONTENTEDITABLE');
  console.log('[LexiLens Highlight] Processing', suggestions.length, 'suggestions...');

  let successCount = 0;
  let failedCount = 0;

  suggestions.forEach((suggestion, index) => {
    console.log(`\n[LexiLens Highlight] ─── Suggestion ${index + 1}/${suggestions.length} ───`);
    console.log('[LexiLens Highlight] Word:', `"${suggestion.original}"`);
    console.log('[LexiLens Highlight] Hint position:', suggestion.position.start);

    // Use fuzzy matching to find exact position
    const pos = findWordPositionFuzzy(text, suggestion.original, suggestion.position.start);

    if (!pos) {
      console.log('[LexiLens Highlight] ❌ Could not find word in text');
      console.log('[LexiLens Highlight] Searched for:', `"${suggestion.original}"`);
      console.log('[LexiLens Highlight] In text:', `"${text.substring(0, 100)}..."`);
      failedCount++;
      return;
    }

    console.log('[LexiLens Highlight] ✅ Found at position:', pos.start, '-', pos.end);
    console.log('[LexiLens Highlight] Matched text:', `"${text.substring(pos.start, pos.end)}"`);

    // Update position
    suggestion.position.start = pos.start;
    suggestion.position.end = pos.end;

    // Get visual rect
    console.log('[LexiLens Highlight] Calculating visual position...');
    const rect = isInput
      ? getInputWordRect(element as HTMLInputElement | HTMLTextAreaElement, pos.start, pos.end)
      : getContentEditableWordRect(element, pos.start, pos.end);

    if (!rect || rect.width < 2) {
      console.log('[LexiLens Highlight] ❌ Invalid rect:', rect);
      if (rect) {
        console.log('[LexiLens Highlight] Rect details: left:', rect.left, 'top:', rect.top, 'width:', rect.width, 'height:', rect.height);
      }
      failedCount++;
      return;
    }

    console.log('[LexiLens Highlight] ✅ Visual rect calculated:');
    console.log('[LexiLens Highlight]   - Position: (', rect.left.toFixed(1), ',', rect.top.toFixed(1), ')');
    console.log('[LexiLens Highlight]   - Size:', rect.width.toFixed(1), 'x', rect.height.toFixed(1), 'px');
    console.log('[LexiLens Highlight]   - Category:', suggestion.category);
    console.log('[LexiLens Highlight]   - Why highlighted:', getCategoryName(suggestion.category));

    const highlight = createHighlightElement(suggestion, rect, element);
    highlightContainer!.appendChild(highlight);
    activeHighlights.set(`${suggestion.original}-${pos.start}`, { element: highlight, suggestion });

    console.log('[LexiLens Highlight] ✅ Highlight created and added to DOM');
    successCount++;
  });

  console.log('\n[LexiLens Highlight] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[LexiLens Highlight] Summary:');
  console.log('[LexiLens Highlight]   ✅ Successfully rendered:', successCount);
  console.log('[LexiLens Highlight]   ❌ Failed:', failedCount);
  console.log('[LexiLens Highlight]   📊 Total highlights on page:', activeHighlights.size);
  console.log('[LexiLens Highlight] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function createHighlightElement(suggestion: SpellingSuggestion, rect: DOMRect, targetElement: HTMLElement): HTMLDivElement {
  const highlight = document.createElement('div');
  highlight.className = 'lexilens-highlight';
  highlight.dataset.word = suggestion.original;
  highlight.dataset.category = suggestion.category || 'purple';

  // Use fixed positioning (viewport-relative)
  highlight.style.position = 'fixed';
  highlight.style.left = `${rect.left}px`;
  highlight.style.top = `${rect.top}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  highlight.classList.add(`category-${suggestion.category || 'purple'}`);

  // Click handler - CRITICAL: Must stop propagation to prevent document click handler
  highlight.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Extra safety

    const wordKey = `${suggestion.original}-${suggestion.position.start}`;

    // Toggle behavior: if already showing this word's popup, close it
    if (currentPopupWord === wordKey && suggestionPopup?.classList.contains('visible')) {
      hideSuggestionPopup();
      return;
    }

    // Otherwise show popup for this word
    // Set flag to prevent document click handler from firing
    isShowingPopup = true;

    // Use setTimeout to ensure click event fully completes first
    setTimeout(() => {
      hideSuggestionPopup();
      showSuggestionPopup(suggestion, rect, targetElement);
      currentPopupWord = wordKey;

      // Reset flag after a short delay
      setTimeout(() => {
        isShowingPopup = false;
      }, 100);
    }, 0);
  });

  return highlight;
}

function repositionHighlights(): void {
  if (!currentFocusedElement) return;

  const text = getElementText(currentFocusedElement);
  const isInput = currentFocusedElement.tagName === 'INPUT' || currentFocusedElement.tagName === 'TEXTAREA';
  const elementRect = currentFocusedElement.getBoundingClientRect();

  activeHighlights.forEach(({ element, suggestion }, key) => {
    const pos = findWordPositionFuzzy(text, suggestion.original, suggestion.position.start);
    if (!pos) {
      element.style.display = 'none';
      return;
    }

    const rect = isInput
      ? getInputWordRect(currentFocusedElement as HTMLInputElement | HTMLTextAreaElement, pos.start, pos.end)
      : getContentEditableWordRect(currentFocusedElement!, pos.start, pos.end);

    if (!rect || rect.width < 2) {
      element.style.display = 'none';
      return;
    }

    // Check if visible within element
    if (rect.right < elementRect.left || rect.left > elementRect.right ||
        rect.bottom < elementRect.top || rect.top > elementRect.bottom) {
      element.style.display = 'none';
      return;
    }

    element.style.display = 'block';
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
  });
}

function clearAllHighlights(): void {
  activeHighlights.forEach(({ element }) => element.remove());
  activeHighlights.clear();
  currentSuggestions = [];
}

// =============================================================================
// Fuzzy Word Position Matching
// =============================================================================

interface WordPosition {
  start: number;
  end: number;
}

/**
 * Find word position using fuzzy matching around the hint position
 * This handles the "stale index" problem when user types during AI analysis
 */
function findWordPositionFuzzy(text: string, word: string, hintStart: number): WordPosition | null {
  const lowerText = text.toLowerCase();
  const lowerWord = word.toLowerCase();

  // 1. First, check EXACT position (best case)
  if (hintStart >= 0 && hintStart + word.length <= text.length) {
    const atHint = lowerText.substring(hintStart, hintStart + word.length);
    if (atHint === lowerWord) {
      // Verify word boundaries
      const before = hintStart === 0 || !/\w/.test(text[hintStart - 1]);
      const after = hintStart + word.length >= text.length || !/\w/.test(text[hintStart + word.length]);
      if (before && after) {
        return { start: hintStart, end: hintStart + word.length };
      }
    }
  }

  // 2. Search in a WINDOW around the hint position (handles minor drift)
  const windowSize = 50; // Search 50 chars before/after
  const searchStart = Math.max(0, hintStart - windowSize);
  const searchEnd = Math.min(text.length, hintStart + word.length + windowSize);

  // Use regex to find word with boundaries in the window
  const searchArea = text.substring(searchStart, searchEnd);
  const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
  const matches: { index: number; distance: number }[] = [];

  let match;
  while ((match = regex.exec(searchArea)) !== null) {
    const absoluteIndex = searchStart + match.index;
    const distance = Math.abs(absoluteIndex - hintStart);
    matches.push({ index: absoluteIndex, distance });
  }

  // Return closest match to hint
  if (matches.length > 0) {
    matches.sort((a, b) => a.distance - b.distance);
    const best = matches[0];
    return { start: best.index, end: best.index + word.length };
  }

  // 3. Global fallback (last resort - may snap to wrong instance)
  const globalRegex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
  const globalMatch = globalRegex.exec(text);
  if (globalMatch) {
    return { start: globalMatch.index, end: globalMatch.index + word.length };
  }

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Accurate Word Rectangle Calculation
// =============================================================================

// Full list of CSS properties that affect text rendering
const MIRROR_CSS_PROPERTIES = [
  'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
  'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
  'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing',
  'tabSize', 'MozTabSize', 'whiteSpace', 'wordWrap', 'wordBreak',
  'textRendering', 'WebkitFontSmoothing'
];

function getInputWordRect(
  element: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number
): DOMRect | null {
  const text = element.value;

  if (start < 0 || end > text.length || start >= end) {
    return null;
  }

  // Use textarea-caret-position library technique
  // This is the MOST ACCURATE way to get text positions in inputs/textareas

  const elementRect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);
  const isInput = element.tagName === 'INPUT';

  // Create a div that exactly mirrors the input
  const div = document.createElement('div');
  const styles = [
    'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontSize', 'fontFamily',
    'lineHeight', 'textAlign', 'textTransform', 'letterSpacing', 'wordSpacing',
    'direction', 'whiteSpace', 'wordWrap', 'wordBreak'
  ];

  // Apply styles
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.overflow = 'auto';
  div.style.pointerEvents = 'none';
  div.style.left = '0';
  div.style.top = '0';

  styles.forEach(prop => {
    const value = computed.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
    (div.style as any)[prop] = value;
  });

  // Critical: Set exact width
  div.style.width = `${element.clientWidth}px`;

  if (isInput) {
    div.style.whiteSpace = 'nowrap';
    div.style.height = 'auto';
  } else {
    div.style.whiteSpace = 'pre-wrap';
    div.style.height = `${element.clientHeight}px`;
  }

  document.body.appendChild(div);

  // Split text and wrap target word in span
  const beforeText = text.substring(0, start);
  const wordText = text.substring(start, end);
  const afterText = text.substring(end);

  // Use innerText to preserve whitespace properly
  div.textContent = beforeText;

  const span = document.createElement('span');
  span.textContent = wordText;
  div.appendChild(span);

  const afterTextNode = document.createTextNode(afterText);
  div.appendChild(afterTextNode);

  // Get the span's position
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();

  // Clean up
  document.body.removeChild(div);

  // Calculate relative position within the element
  const relativeLeft = spanRect.left - divRect.left;
  const relativeTop = spanRect.top - divRect.top;

  // Account for scroll
  const scrollLeft = element.scrollLeft || 0;
  const scrollTop = element.scrollTop || 0;

  // Account for padding
  const paddingLeft = parseFloat(computed.paddingLeft) || 0;
  const paddingTop = parseFloat(computed.paddingTop) || 0;

  // Calculate viewport position
  const left = elementRect.left + paddingLeft + relativeLeft - scrollLeft;
  const top = elementRect.top + paddingTop + relativeTop - scrollTop;

  // Check if visible
  if (left + spanRect.width < elementRect.left ||
      left > elementRect.right ||
      top + spanRect.height < elementRect.top ||
      top > elementRect.bottom) {
    return null;
  }

  // Clamp to element bounds
  const clampedLeft = Math.max(left, elementRect.left);
  const clampedTop = Math.max(top, elementRect.top);
  const clampedRight = Math.min(left + spanRect.width, elementRect.right);
  const clampedBottom = Math.min(top + spanRect.height, elementRect.bottom);

  const width = clampedRight - clampedLeft;
  const height = clampedBottom - clampedTop;

  if (width < 1 || height < 1) {
    return null;
  }

  return new DOMRect(clampedLeft, clampedTop, width, height);
}

function getContentEditableWordRect(element: HTMLElement, start: number, end: number): DOMRect | null {
  try {
    // Walk text nodes to find the right position
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let node: Text | null;
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;

    while ((node = walker.nextNode() as Text)) {
      const nodeLength = node.textContent?.length || 0;

      if (!startNode && currentOffset + nodeLength > start) {
        startNode = node;
        startOffset = start - currentOffset;
      }

      if (currentOffset + nodeLength >= end) {
        endNode = node;
        endOffset = end - currentOffset;
        break;
      }

      currentOffset += nodeLength;
    }

    if (!startNode || !endNode) return null;

    const range = document.createRange();
    range.setStart(startNode, Math.min(startOffset, startNode.length));
    range.setEnd(endNode, Math.min(endOffset, endNode.length));

    const rect = range.getBoundingClientRect();
    return rect.width > 0 ? rect : null;
  } catch (e) {
    console.error('[LexiLens] ContentEditable rect error:', e);
    return null;
  }
}

// =============================================================================
// Suggestion Popup
// =============================================================================

function getCategoryInfo(category: string): { icon: string; title: string; badge: string } {
  switch (category) {
    case 'purple':
      return { icon: '🔍', title: 'Spelling Error', badge: 'Detective' };
    case 'yellow':
      return { icon: '⚠️', title: 'Evil Twin Alert', badge: 'Choose Meaning' };
    case 'blue':
      return { icon: '✓', title: 'Verify This', badge: 'Enforcer' };
    case 'orange':
      return { icon: '✏️', title: 'Quick Fix', badge: 'Typo' };
    default:
      return { icon: '📝', title: 'Spelling Note', badge: 'Check' };
  }
}

function showSuggestionPopup(suggestion: SpellingSuggestion, rect: DOMRect, element: HTMLElement): void {
  if (!suggestionPopup) return;

  // Hide first to reset state
  suggestionPopup.classList.remove('visible');
  suggestionPopup.style.display = 'none';

  const category = suggestion.category || 'purple';
  const categoryInfo = getCategoryInfo(category);

  suggestionPopup.className = `lexilens-suggestion-popup category-${category}`;

  suggestionPopup.innerHTML = `
    <div class="lexilens-popup-header">
      <span class="lexilens-popup-icon">${categoryInfo.icon}</span>
      <span class="lexilens-popup-title">${categoryInfo.title}</span>
      <span class="lexilens-popup-badge">${categoryInfo.badge}</span>
    </div>
    ${suggestion.tip ? `<div class="lexilens-popup-tip">${suggestion.tip}</div>` : ''}
    <div class="lexilens-popup-original">
      You wrote: <span class="original-word">${suggestion.original}</span>
    </div>
    <div class="lexilens-popup-suggestions">
      ${suggestion.suggestions.map((word, i) => `
        <button class="lexilens-suggestion-btn ${i === 0 ? 'primary' : ''}" data-word="${word}">
          <span class="suggestion-word">${word}</span>
          ${i === 0 ? '<span class="suggestion-badge">Suggested</span>' : ''}
        </button>
      `).join('')}
    </div>
    <div class="lexilens-popup-footer">
      <button class="lexilens-action-btn dismiss" data-action="dismiss">Ignore</button>
      <button class="lexilens-action-btn learn" data-action="learn">Add to Dictionary</button>
    </div>
  `;

  // Position popup - measure first
  suggestionPopup.style.display = 'block';
  suggestionPopup.style.left = '-9999px';
  suggestionPopup.style.top = '-9999px';

  const popupRect = suggestionPopup.getBoundingClientRect();
  const padding = 10;

  let left = rect.left;
  let top = rect.bottom + padding;

  // Adjust horizontal
  if (left + popupRect.width > window.innerWidth - padding) {
    left = window.innerWidth - popupRect.width - padding;
  }
  if (left < padding) left = padding;

  // Adjust vertical - flip above if no room below
  if (top + popupRect.height > window.innerHeight - padding) {
    top = rect.top - popupRect.height - padding;
  }
  if (top < padding) top = padding;

  suggestionPopup.style.left = `${left}px`;
  suggestionPopup.style.top = `${top}px`;

  // Show with animation
  requestAnimationFrame(() => {
    suggestionPopup!.classList.add('visible');
  });

  // Event listeners for suggestion buttons
  suggestionPopup.querySelectorAll('.lexilens-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const word = (btn as HTMLElement).dataset.word;
      if (word) applySuggestion(suggestion, word, element);
    });
  });

  // Event listeners for action buttons
  suggestionPopup.querySelectorAll('.lexilens-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = (btn as HTMLElement).dataset.action;
      if (action === 'dismiss') {
        dismissSuggestion(suggestion);
      } else if (action === 'learn') {
        addToCustomTerms(suggestion.original);
        dismissSuggestion(suggestion);
      }
    });
  });
}

function hideSuggestionPopup(): void {
  if (suggestionPopup) {
    suggestionPopup.classList.remove('visible');
    suggestionPopup.style.display = 'none';
  }
  currentPopupWord = null;
}

// =============================================================================
// Actions
// =============================================================================

function applySuggestion(suggestion: SpellingSuggestion, replacement: string, element: HTMLElement): void {
  const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';

  if (isInput) {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const text = input.value;
    input.value = text.substring(0, suggestion.position.start) + replacement + text.substring(suggestion.position.end);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    const text = element.innerText || '';
    element.innerText = text.substring(0, suggestion.position.start) + replacement + text.substring(suggestion.position.end);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  hideSuggestionPopup();
  removeHighlight(suggestion);

  // Re-analyze
  lastAnalyzedText = '';
  const newText = getElementText(element);
  if (newText.length > 2) {
    debouncedAnalyze(newText, element);
  }
}

function dismissSuggestion(suggestion: SpellingSuggestion): void {
  hideSuggestionPopup();
  removeHighlight(suggestion);
}

function removeHighlight(suggestion: SpellingSuggestion): void {
  const key = `${suggestion.original}-${suggestion.position.start}`;
  const item = activeHighlights.get(key);
  if (item) {
    item.element.remove();
    activeHighlights.delete(key);
  }
  currentSuggestions = currentSuggestions.filter(
    s => !(s.original === suggestion.original && s.position.start === suggestion.position.start)
  );
}

async function addToCustomTerms(word: string): Promise<void> {
  if (!settings) return;

  const currentTerms = settings.ai?.customTerms || [];
  if (!currentTerms.includes(word.toLowerCase())) {
    const newTerms = [...currentTerms, word.toLowerCase()];
    const updatedAI = { ...settings.ai, customTerms: newTerms };
    settings = { ...settings, ai: updatedAI };

    try {
      const { updateSettings } = await import('../../utils/storage');
      await updateSettings({ ai: updatedAI });
      console.log('[LexiLens] Added to dictionary:', word);
    } catch (e) {
      console.error('[LexiLens] Failed to save:', e);
    }
  }
}

// =============================================================================
// Utilities
// =============================================================================

function isEditableElement(element: HTMLElement): boolean {
  if (!element) return false;

  if (element.tagName === 'INPUT') {
    const type = (element as HTMLInputElement).type?.toLowerCase();
    return ['text', 'search', 'email', 'url', 'tel', ''].includes(type);
  }

  if (element.tagName === 'TEXTAREA') return true;
  if (element.isContentEditable) return true;

  return false;
}

function getElementText(element: HTMLElement): string {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value;
  }
  return element.innerText || element.textContent || '';
}

function handleBackgroundMessage(message: LexiLensMessage): void {
  console.log('[LexiLens] Message:', message.type);
  if (message.type === 'SETTINGS_UPDATED' && message.payload) {
    settings = { ...settings, ...message.payload } as LexiLensSettings;
  }
}

