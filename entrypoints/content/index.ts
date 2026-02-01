/**
 * LexiLens Content Script
 * Grammarly-style inline highlighting for dyslexia-specific spelling issues
 */

import { debounceWithCancel } from '../../utils/debounce';
import { analyzeText } from '../../utils/phonetic-engine';
import { loadSettings, onSettingsChange } from '../../utils/storage';
import { onContentMessage } from '../../utils/messages';
import type { LexiLensSettings, SpellingSuggestion, LexiLensMessage } from '../../types';
import './style.css';

// Browser AI module - lazily loaded
let browserAIModule: typeof import('../../utils/browser-ai') | null = null;

// =============================================================================
// State
// =============================================================================

let settings: LexiLensSettings | null = null;
let currentFocusedElement: HTMLElement | null = null;
let highlightContainer: HTMLDivElement | null = null;
let suggestionPopup: HTMLDivElement | null = null;
let currentSuggestions: SpellingSuggestion[] = [];
let activeHighlights: Map<string, HTMLDivElement> = new Map();
let isPopupHovered = false;
let isHighlightHovered = false;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let browserAIReady = false;
let aiLoadingPromise: Promise<boolean> | null = null;

// =============================================================================
// Content Script Definition
// =============================================================================

export default defineContentScript({
  matches: ['<all_urls>'],

  async main() {
    console.log('[LexiLens] Content script initialized');

    // Load initial settings
    settings = await loadSettings();

    // Initialize the highlight system
    if (settings.correctionEnabled) {
      initializeHighlightSystem();
    }

    // Initialize browser AI if enabled
    if (settings.browserAI?.enabled) {
      initBrowserAI();
    }

    // Listen for settings changes
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

      // Handle browser AI toggle
      if (newSettings.browserAI?.enabled !== prevSettings?.browserAI?.enabled) {
        if (newSettings.browserAI?.enabled) {
          initBrowserAI();
        }
      }
    });

    // Listen for messages from background
    onContentMessage(handleBackgroundMessage);
  },
});

/**
 * Initialize browser AI model (lazy loading)
 */
async function initBrowserAI(): Promise<void> {
  if (browserAIReady || aiLoadingPromise) return;

  // Lazy load the browser AI module
  if (!browserAIModule) {
    try {
      browserAIModule = await import('../../utils/browser-ai');
    } catch (e) {
      console.error('[LexiLens] Failed to load AI module:', e);
      return;
    }
  }

  const hasWebGPU = await browserAIModule.checkWebGPUSupport();
  if (!hasWebGPU) {
    console.log('[LexiLens] WebGPU not supported, AI disabled');
    return;
  }

  console.log('[LexiLens] Loading browser AI model...');
  aiLoadingPromise = browserAIModule.initializeBrowserAI(
    settings?.browserAI?.modelId || 'smollm',
    (progress) => {
      console.log(`[LexiLens] AI loading: ${Math.round(progress * 100)}%`);
    }
  );

  browserAIReady = await aiLoadingPromise;
  aiLoadingPromise = null;

  if (browserAIReady) {
    console.log('[LexiLens] Browser AI ready!');
  }
}

// =============================================================================
// Highlight System (Grammarly-style)
// =============================================================================

function initializeHighlightSystem(): void {
  // Create container for highlight overlays
  if (!highlightContainer) {
    highlightContainer = document.createElement('div');
    highlightContainer.id = 'lexilens-highlight-container';
    highlightContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(highlightContainer);
  }

  // Create suggestion popup
  if (!suggestionPopup) {
    suggestionPopup = document.createElement('div');
    suggestionPopup.id = 'lexilens-suggestion-popup';
    suggestionPopup.setAttribute('role', 'tooltip');
    document.body.appendChild(suggestionPopup);

    // Track popup hover state
    suggestionPopup.addEventListener('mouseenter', () => {
      isPopupHovered = true;
      cancelHideTimeout();
    });

    suggestionPopup.addEventListener('mouseleave', () => {
      isPopupHovered = false;
      scheduleHidePopup();
    });
  }

  // Listen for focus on editable elements
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('scroll', updateHighlightPositions, true);
  window.addEventListener('resize', updateHighlightPositions);

  // Close popup when clicking outside
  document.addEventListener('click', handleDocumentClick, true);

  console.log('[LexiLens] Highlight system initialized');
}

function destroyHighlightSystem(): void {
  document.removeEventListener('focusin', handleFocusIn, true);
  document.removeEventListener('focusout', handleFocusOut, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('scroll', updateHighlightPositions, true);
  document.removeEventListener('click', handleDocumentClick, true);
  window.removeEventListener('resize', updateHighlightPositions);

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
// Focus & Input Handling
// =============================================================================

function handleFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement;

  if (isEditableElement(target)) {
    currentFocusedElement = target;
    console.log('[LexiLens] Focused on editable:', target.tagName);

    // Analyze existing content
    const text = getElementText(target);
    if (text.length > 2) {
      debouncedAnalyze(text, target);
    }
  }
}

function handleFocusOut(event: FocusEvent): void {
  const target = event.target as HTMLElement;
  const relatedTarget = event.relatedTarget as HTMLElement | null;

  // Don't clear if clicking on popup or highlight
  if (relatedTarget) {
    if (
      suggestionPopup?.contains(relatedTarget) ||
      highlightContainer?.contains(relatedTarget)
    ) {
      return;
    }
  }

  // Longer delay to allow interactions
  setTimeout(() => {
    // Only clear if we're not hovering popup/highlight and focus hasn't returned
    if (!isPopupHovered && !isHighlightHovered) {
      if (target === currentFocusedElement) {
        // Check if we've focused back on the same element
        if (document.activeElement !== currentFocusedElement) {
          clearAllHighlights();
          hideSuggestionPopup();
          currentFocusedElement = null;
          debouncedAnalyze.cancel();
        }
      }
    }
  }, 300);
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  // If clicking outside popup and highlights, hide popup
  if (
    suggestionPopup &&
    !suggestionPopup.contains(target) &&
    !highlightContainer?.contains(target)
  ) {
    hideSuggestionPopup();
  }
}

function handleInput(event: Event): void {
  if (!settings?.correctionEnabled) return;

  const target = event.target as HTMLElement;

  if (isEditableElement(target)) {
    const text = getElementText(target);

    // Hide popup while typing
    hideSuggestionPopup();

    if (text.length > 2) {
      debouncedAnalyze(text, target);
    } else {
      clearAllHighlights();
    }
  }
}

function isEditableElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toUpperCase();

  if (tagName === 'INPUT') {
    const inputType = (element as HTMLInputElement).type.toLowerCase();
    return ['text', 'search', 'email', 'url', 'tel', ''].includes(inputType);
  }

  if (tagName === 'TEXTAREA') {
    return true;
  }

  return element.isContentEditable;
}

function getElementText(element: HTMLElement): string {
  if ('value' in element) {
    return (element as HTMLInputElement | HTMLTextAreaElement).value;
  }
  return element.innerText || element.textContent || '';
}

// =============================================================================
// Text Analysis
// =============================================================================

const debouncedAnalyze = debounceWithCancel(
  (text: string, element: HTMLElement) => {
    performAnalysis(text, element);
  },
  500
);

async function performAnalysis(text: string, element: HTMLElement): Promise<void> {
  console.log('[LexiLens] Analyzing:', text.substring(0, 50));

  // Start with local dictionary (instant)
  let suggestions = analyzeText(text);

  // Show immediate results
  if (suggestions.length > 0) {
    currentSuggestions = suggestions;
    renderHighlights(suggestions, element);
  }

  // If browser AI is ready and text needs context analysis
  if (browserAIReady && browserAIModule && settings?.browserAI?.enabled) {
    const shouldUseAI = browserAIModule.shouldUseBrowserAI(text);

    if (shouldUseAI) {
      console.log('[LexiLens] Running browser AI analysis...');

      try {
        const aiSuggestions = await browserAIModule.analyzeWithBrowserAI(text, {
          enabled: true,
          modelId: settings.browserAI.modelId,
          customTerms: settings.browserAI.customTerms || [],
        });

        if (aiSuggestions.length > 0) {
          // Merge AI suggestions with local ones
          const merged = mergeSuggestions(suggestions, aiSuggestions);
          currentSuggestions = merged;
          renderHighlights(merged, element);
          console.log('[LexiLens] AI found additional issues:', aiSuggestions.length);
        }
      } catch (error) {
        console.error('[LexiLens] AI analysis failed:', error);
      }
    }
  }

  if (currentSuggestions.length === 0) {
    clearAllHighlights();
  }
}

/**
 * Merge local and AI suggestions, avoiding duplicates
 */
function mergeSuggestions(
  local: SpellingSuggestion[],
  ai: SpellingSuggestion[]
): SpellingSuggestion[] {
  const seen = new Map<string, SpellingSuggestion>();

  for (const s of local) {
    seen.set(s.original.toLowerCase(), s);
  }

  for (const s of ai) {
    const key = s.original.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, s);
    }
  }

  return Array.from(seen.values());
}

// =============================================================================
// Highlight Rendering
// =============================================================================

function renderHighlights(suggestions: SpellingSuggestion[], element: HTMLElement): void {
  clearAllHighlights();

  if (!highlightContainer) return;

  const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';

  suggestions.forEach((suggestion, index) => {
    const highlight = createHighlight(suggestion, element, index, isInput);
    if (highlight) {
      highlightContainer!.appendChild(highlight);
      activeHighlights.set(`${suggestion.position.start}-${suggestion.position.end}`, highlight);
    }
  });
}

function createHighlight(
  suggestion: SpellingSuggestion,
  element: HTMLElement,
  index: number,
  isInput: boolean
): HTMLDivElement | null {
  const rect = getWordRect(suggestion, element, isInput);
  if (!rect) return null;

  const highlight = document.createElement('div');
  highlight.className = 'lexilens-highlight';
  highlight.dataset.index = String(index);
  highlight.dataset.word = suggestion.original;

  // Position the highlight to cover the ENTIRE word (not just underline)
  // This makes hovering much easier - any part of the word triggers popup
  highlight.style.left = `${rect.left + window.scrollX}px`;
  highlight.style.top = `${rect.top + window.scrollY}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  // Color based on confidence
  if (suggestion.confidence > 0.8) {
    highlight.classList.add('high-confidence');
  } else {
    highlight.classList.add('medium-confidence');
  }

  // Show popup on HOVER - anywhere on the word!
  highlight.addEventListener('mouseenter', () => {
    isHighlightHovered = true;
    cancelHideTimeout();
    showSuggestionPopup(suggestion, rect, element);
  });

  highlight.addEventListener('mouseleave', () => {
    isHighlightHovered = false;
    scheduleHidePopup();
  });

  // Also support click
  highlight.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showSuggestionPopup(suggestion, rect, element);
  });

  return highlight;
}

// =============================================================================
// Popup Timing Helpers
// =============================================================================

function cancelHideTimeout(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function scheduleHidePopup(): void {
  cancelHideTimeout();
  hideTimeout = setTimeout(() => {
    if (!isPopupHovered && !isHighlightHovered) {
      hideSuggestionPopup();
    }
  }, 300);
}

// =============================================================================
// Word Position Calculation
// =============================================================================

function getWordRect(
  suggestion: SpellingSuggestion,
  element: HTMLElement,
  isInput: boolean
): DOMRect | null {
  try {
    if (isInput) {
      return getInputWordRect(suggestion, element as HTMLInputElement | HTMLTextAreaElement);
    } else {
      return getContentEditableWordRect(suggestion, element);
    }
  } catch (e) {
    console.error('[LexiLens] Failed to get word rect:', e);
    return null;
  }
}

function getInputWordRect(
  suggestion: SpellingSuggestion,
  element: HTMLInputElement | HTMLTextAreaElement
): DOMRect | null {
  const text = element.value;

  // Verify the word exists at the expected position
  const expectedWord = text.substring(suggestion.position.start, suggestion.position.end);
  if (expectedWord.toLowerCase() !== suggestion.original.toLowerCase()) {
    // Word moved - try to find it again
    const newStart = text.toLowerCase().indexOf(suggestion.original.toLowerCase());
    if (newStart === -1) return null;
    suggestion.position.start = newStart;
    suggestion.position.end = newStart + suggestion.original.length;
  }

  // Create a mirror div to measure text position
  const mirror = document.createElement('div');
  const computed = window.getComputedStyle(element);

  const stylesToCopy = [
    'font-family', 'font-size', 'font-weight', 'font-style',
    'letter-spacing', 'word-spacing', 'text-transform',
    'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
    'border-left-width', 'border-right-width', 'border-top-width', 'border-bottom-width',
    'box-sizing', 'line-height', 'text-indent'
  ];

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'hidden';

  stylesToCopy.forEach(style => {
    mirror.style.setProperty(style, computed.getPropertyValue(style));
  });

  const isInput = element.tagName === 'INPUT';

  if (isInput) {
    mirror.style.whiteSpace = 'pre';
    mirror.style.width = 'auto';
    mirror.style.height = 'auto';
  } else {
    // Textarea - match dimensions
    mirror.style.width = `${element.clientWidth}px`;
    mirror.style.height = 'auto';
  }

  document.body.appendChild(mirror);

  const beforeText = text.substring(0, suggestion.position.start);
  const wordText = text.substring(suggestion.position.start, suggestion.position.end);

  // Use spans to measure positions
  const beforeSpan = document.createElement('span');
  beforeSpan.textContent = beforeText.replace(/ /g, '\u00a0'); // Preserve spaces

  const wordSpan = document.createElement('span');
  wordSpan.style.backgroundColor = 'red'; // Debug: helps verify positioning
  wordSpan.textContent = wordText;

  mirror.appendChild(beforeSpan);
  mirror.appendChild(wordSpan);

  const elementRect = element.getBoundingClientRect();
  const wordRect = wordSpan.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  // Account for scroll position within the input/textarea
  const scrollLeft = element.scrollLeft || 0;
  const scrollTop = element.scrollTop || 0;

  // Calculate position relative to the input element
  const relativeLeft = wordRect.left - mirrorRect.left - scrollLeft;
  const relativeTop = wordRect.top - mirrorRect.top - scrollTop;

  const result = new DOMRect(
    elementRect.left + relativeLeft,
    elementRect.top + relativeTop,
    wordRect.width,
    wordRect.height
  );

  document.body.removeChild(mirror);

  // Validate result is within element bounds
  if (result.left < elementRect.left || result.right > elementRect.right + 10) {
    // Word is scrolled out of view
    return null;
  }

  return result;
}

function getContentEditableWordRect(
  suggestion: SpellingSuggestion,
  element: HTMLElement
): DOMRect | null {
  const textNode = findTextNode(element, suggestion.position.start);
  if (!textNode) return null;

  const range = document.createRange();
  const localStart = suggestion.position.start - getTextNodeOffset(element, textNode);
  const localEnd = Math.min(localStart + suggestion.original.length, textNode.length);

  range.setStart(textNode, Math.max(0, localStart));
  range.setEnd(textNode, localEnd);

  return range.getBoundingClientRect();
}

function findTextNode(element: HTMLElement, targetOffset: number): Text | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node: Text | null;

  while ((node = walker.nextNode() as Text)) {
    const nodeLength = node.textContent?.length || 0;
    if (currentOffset + nodeLength > targetOffset) {
      return node;
    }
    currentOffset += nodeLength;
  }

  return null;
}

function getTextNodeOffset(element: HTMLElement, targetNode: Text): number {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Text | null;

  while ((node = walker.nextNode() as Text)) {
    if (node === targetNode) return offset;
    offset += node.textContent?.length || 0;
  }

  return offset;
}

function updateHighlightPositions(): void {
  if (!currentFocusedElement || currentSuggestions.length === 0) return;
  renderHighlights(currentSuggestions, currentFocusedElement);
}

function clearAllHighlights(): void {
  activeHighlights.forEach(highlight => highlight.remove());
  activeHighlights.clear();
}

// =============================================================================
// Dyslexia-Friendly Messaging (Our Key Differentiator!)
// =============================================================================

interface DyslexiaMessage {
  title: string;
  explanation: string;
}

/**
 * Generate encouraging, educational messages that explain WHY a word was flagged
 * This is what makes us different from Grammarly - we don't just correct,
 * we help users understand common dyslexia patterns
 */
function getDyslexiaFriendlyMessage(suggestion: SpellingSuggestion): DyslexiaMessage {
  const original = suggestion.original.toLowerCase();
  const suggested = suggestion.suggestions[0]?.toLowerCase() || '';

  // Check for letter reversals (b/d, p/q)
  if (hasLetterReversal(original, suggested)) {
    return {
      title: 'Letter Mix-up Spotted',
      explanation: `Letters like <strong>b/d</strong> and <strong>p/q</strong> are easy to flip — your brain processes them similarly. This is super common!`
    };
  }

  // Check for phonetic spelling (sounds right, spelled differently)
  if (isPhoneticSpelling(original, suggested)) {
    return {
      title: 'Sounds Right, Looks Different',
      explanation: `You spelled it how it <em>sounds</em> — that's actually logical! English spelling is just weird sometimes. 🤷`
    };
  }

  // Check for double letter issues
  if (hasDoubleLetterIssue(original, suggested)) {
    return {
      title: 'Double Letter Tricky Spot',
      explanation: `Double letters are hard to hear when speaking, so they're easy to miss or add. You're not alone — this trips up everyone!`
    };
  }

  // Check for homophones
  if (isHomophone(original)) {
    return {
      title: 'Sound-Alike Words',
      explanation: `These words sound identical but mean different things. Context is key here — even spell-checkers struggle with these!`
    };
  }

  // Check for silent letters
  if (hasSilentLetterIssue(original, suggested)) {
    return {
      title: 'Sneaky Silent Letter',
      explanation: `This word has a <em>silent letter</em> that you can't hear when speaking. English borrowed this from other languages — blame the French! 🇫🇷`
    };
  }

  // Check for common suffixes
  if (hasSuffixConfusion(original, suggested)) {
    return {
      title: 'Tricky Ending',
      explanation: `Word endings like <strong>-tion/-sion</strong>, <strong>-ible/-able</strong> sound similar but are spelled differently. Even great writers look these up!`
    };
  }

  // Default encouraging message
  return {
    title: 'Quick Spelling Note',
    explanation: `This is a common word that trips people up. Your brain knew what you meant — let's just adjust the spelling.`
  };
}

/**
 * Check if the error involves letter reversals (b/d, p/q, m/w, n/u)
 */
function hasLetterReversal(original: string, suggested: string): boolean {
  const reversalPairs = [
    ['b', 'd'], ['d', 'b'],
    ['p', 'q'], ['q', 'p'],
    ['m', 'w'], ['w', 'm'],
    ['n', 'u'], ['u', 'n']
  ];

  for (const [a, b] of reversalPairs) {
    if (original.includes(a) && suggested.includes(b)) {
      const replaced = original.replace(new RegExp(a, 'g'), b);
      if (replaced === suggested) return true;
    }
  }
  return false;
}

/**
 * Check if this is a phonetic spelling (wrote it how it sounds)
 */
function isPhoneticSpelling(original: string, suggested: string): boolean {
  const phoneticPatterns = [
    // Common phonetic misspellings
    ['frend', 'friend'],
    ['sed', 'said'],
    ['rite', 'right'],
    ['nite', 'night'],
    ['lite', 'light'],
    ['thru', 'through'],
    ['tho', 'though'],
    ['enuf', 'enough'],
    ['cuz', 'because'],
    ['becuz', 'because'],
    ['shud', 'should'],
    ['cud', 'could'],
    ['wud', 'would'],
    ['peple', 'people'],
    ['pepole', 'people'],
  ];

  return phoneticPatterns.some(([wrong, right]) =>
    original === wrong && suggested === right
  );
}

/**
 * Check for double letter issues
 */
function hasDoubleLetterIssue(original: string, suggested: string): boolean {
  // Check if the difference is a doubled/undoubled letter
  const doubleLetterWords = [
    'accommodate', 'occurrence', 'committee', 'millennium',
    'necessary', 'occasionally', 'recommend', 'tomorrow',
    'beginning', 'succeeded', 'misspell', 'embarrass'
  ];

  if (doubleLetterWords.includes(suggested)) {
    return true;
  }

  // Simple check: length differs by 1 and one has repeated letters
  if (Math.abs(original.length - suggested.length) === 1) {
    const longer = original.length > suggested.length ? original : suggested;
    return /(.)\1/.test(longer);
  }

  return false;
}

/**
 * Check if word is a common homophone
 */
function isHomophone(word: string): boolean {
  const homophones = [
    'their', 'there', 'theyre', "they're",
    'your', 'youre', "you're",
    'its', "it's", 'its',
    'to', 'too', 'two',
    'hear', 'here',
    'know', 'no',
    'write', 'right', 'rite',
    'where', 'wear', 'were',
    'which', 'witch',
    'weather', 'whether',
    'peace', 'piece',
    'wait', 'weight',
    'brake', 'break',
    'flour', 'flower'
  ];
  return homophones.includes(word.toLowerCase());
}

/**
 * Check for silent letter issues
 */
function hasSilentLetterIssue(original: string, suggested: string): boolean {
  const silentLetterWords: Record<string, string> = {
    'nife': 'knife',
    'nock': 'knock',
    'nee': 'knee',
    'nit': 'knit',
    'rong': 'wrong',
    'rist': 'wrist',
    'rite': 'write',
    'reck': 'wreck',
    'sychology': 'psychology',
    'neumonia': 'pneumonia',
    'lam': 'lamb',
    'dum': 'dumb',
    'det': 'debt',
    'dout': 'doubt',
    'iland': 'island',
    'lisen': 'listen',
    'casle': 'castle',
    'wistle': 'whistle',
  };

  return silentLetterWords[original] === suggested;
}

/**
 * Check for suffix confusion
 */
function hasSuffixConfusion(original: string, suggested: string): boolean {
  const suffixPairs = [
    [/tion$/, /sion$/],
    [/able$/, /ible$/],
    [/ance$/, /ence$/],
    [/ant$/, /ent$/],
    [/er$/, /or$/],
    [/ful$/, /full$/],
  ];

  for (const [pattern1, pattern2] of suffixPairs) {
    if ((pattern1.test(original) && pattern2.test(suggested)) ||
        (pattern2.test(original) && pattern1.test(suggested))) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// Suggestion Popup
// =============================================================================

function showSuggestionPopup(
  suggestion: SpellingSuggestion,
  rect: DOMRect,
  element: HTMLElement
): void {
  if (!suggestionPopup) return;

  cancelHideTimeout();

  const corrections = suggestion.suggestions;

  // Get friendly message based on the type of error
  const { title, explanation } = getDyslexiaFriendlyMessage(suggestion);

  suggestionPopup.innerHTML = `
    <div class="lexilens-popup-header">
      <span class="lexilens-popup-icon">💡</span>
      <span class="lexilens-popup-title">${title}</span>
    </div>
    <div class="lexilens-popup-explanation">
      ${explanation}
    </div>
    <div class="lexilens-popup-original">
      You wrote: <span class="original-word">${suggestion.original}</span>
    </div>
    <div class="lexilens-popup-suggestions">
      ${corrections.map((word, i) => `
        <button class="lexilens-suggestion-btn ${i === 0 ? 'primary' : ''}" data-word="${word}">
          <span class="suggestion-word">${word}</span>
          ${i === 0 ? '<span class="suggestion-badge">Best match</span>' : ''}
        </button>
      `).join('')}
    </div>
    <div class="lexilens-popup-footer">
      <button class="lexilens-dismiss-btn" data-action="dismiss">Ignore this time</button>
      <button class="lexilens-learn-btn" data-action="learn">Add to my dictionary</button>
    </div>
    <div class="lexilens-popup-reassurance">
      🧠 This is a common dyslexia pattern — you're doing great!
    </div>
  `;

  // Position popup - ensure it stays within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // First, make popup visible but off-screen to measure it
  suggestionPopup.style.left = '-9999px';
  suggestionPopup.style.top = '-9999px';
  suggestionPopup.classList.add('visible');

  const popupRect = suggestionPopup.getBoundingClientRect();
  const popupWidth = popupRect.width || 300;
  const popupHeight = popupRect.height || 250;

  // Calculate ideal position (below the word)
  let popupX = rect.left;
  let popupY = rect.bottom + 8;

  // Keep popup within horizontal bounds
  if (popupX + popupWidth > viewportWidth - 10) {
    popupX = viewportWidth - popupWidth - 10;
  }
  if (popupX < 10) {
    popupX = 10;
  }

  // If popup would go below viewport, show it above the word instead
  if (popupY + popupHeight > viewportHeight - 10) {
    popupY = rect.top - popupHeight - 8;
  }

  // If still outside (word is at very top), just show at top
  if (popupY < 10) {
    popupY = 10;
  }

  suggestionPopup.style.left = `${popupX + window.scrollX}px`;
  suggestionPopup.style.top = `${popupY + window.scrollY}px`;

  // Handle clicks on suggestions
  suggestionPopup.querySelectorAll('.lexilens-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const word = (e.target as HTMLElement).closest('.lexilens-suggestion-btn')?.getAttribute('data-word');
      if (word) {
        // Remove highlight immediately
        removeHighlightForSuggestion(suggestion);
        applySuggestion(suggestion, word, element);
      }
    });
  });

  // Handle dismiss - remove highlight so it doesn't bother user again
  suggestionPopup.querySelector('.lexilens-dismiss-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeHighlightForSuggestion(suggestion);
    hideSuggestionPopup();
  });

  // Handle "Add to dictionary"
  suggestionPopup.querySelector('.lexilens-learn-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Add to custom terms in settings
    addToCustomTerms(suggestion.original);
    removeHighlightForSuggestion(suggestion);
    hideSuggestionPopup();
  });
}

/**
 * Remove highlight for a specific suggestion
 */
function removeHighlightForSuggestion(suggestion: SpellingSuggestion): void {
  const key = `${suggestion.position.start}-${suggestion.position.end}`;
  const highlight = activeHighlights.get(key);
  if (highlight) {
    highlight.remove();
    activeHighlights.delete(key);
  }

  // Also remove from currentSuggestions so it doesn't reappear
  currentSuggestions = currentSuggestions.filter(
    s => s.position.start !== suggestion.position.start || s.position.end !== suggestion.position.end
  );
}

/**
 * Add word to custom terms (ignore list)
 */
async function addToCustomTerms(word: string): Promise<void> {
  if (!settings) return;

  const currentTerms = settings.browserAI?.customTerms || [];
  if (!currentTerms.includes(word.toLowerCase())) {
    const newTerms = [...currentTerms, word.toLowerCase()];

    // Update settings
    const updatedAI = { ...settings.browserAI, customTerms: newTerms };
    settings = { ...settings, browserAI: updatedAI };

    // Persist to storage
    try {
      const { updateSettings } = await import('../../utils/storage');
      await updateSettings({ browserAI: updatedAI });
      console.log('[LexiLens] Added to dictionary:', word);
    } catch (e) {
      console.error('[LexiLens] Failed to save custom term:', e);
    }
  }
}

function hideSuggestionPopup(): void {
  if (suggestionPopup) {
    suggestionPopup.classList.remove('visible');
  }
}

function applySuggestion(
  suggestion: SpellingSuggestion,
  replacement: string,
  element: HTMLElement
): void {
  const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';

  if (isInput) {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const text = input.value;
    const newText =
      text.substring(0, suggestion.position.start) +
      replacement +
      text.substring(suggestion.position.end);

    input.value = newText;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const newCursorPos = suggestion.position.start + replacement.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
    input.focus();
  } else {
    const text = element.innerText;
    const newText =
      text.substring(0, suggestion.position.start) +
      replacement +
      text.substring(suggestion.position.end);

    element.innerText = newText;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  hideSuggestionPopup();

  // Re-analyze after applying
  setTimeout(() => {
    const newText = getElementText(element);
    if (newText.length > 2) {
      performAnalysis(newText, element);
    } else {
      clearAllHighlights();
    }
  }, 100);
}

// =============================================================================
// Message Handling
// =============================================================================

function handleBackgroundMessage(message: LexiLensMessage): void {
  switch (message.type) {
    case 'SETTINGS_UPDATED':
      break;

    case 'ANALYSIS_RESULT':
      if (currentFocusedElement && message.payload.suggestions.length > 0) {
        currentSuggestions = message.payload.suggestions;
        renderHighlights(message.payload.suggestions, currentFocusedElement);
      }
      break;
  }
}

