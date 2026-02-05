/**
 * LexiLens Content Script - Status Bar Approach
 * Shows issue count in a status bar, opens modal for sentence-by-sentence review
 */

import { debounceWithCancel } from '../../utils/debounce';
import { analyzeText as analyzeTextLocal } from '../../utils/phonetic-engine';
import { loadSettings, onSettingsChange, updateSettings } from '../../utils/storage';
import { onContentMessage, broadcastSettingsUpdate } from '../../utils/messages';
import type { LexiLensSettings, SpellingSuggestion, LexiLensMessage } from '../../types';
import './style.css';
import './status-bar.css';

let aiEngineModule: typeof import('../../utils/ai-engine') | null = null;

// =============================================================================
// State
// =============================================================================

let settings: LexiLensSettings | null = null;
let currentFocusedElement: HTMLElement | null = null;
let statusBar: HTMLDivElement | null = null;
let reviewModal: HTMLDivElement | null = null;
let currentSuggestions: SpellingSuggestion[] = [];
let currentSentences: Array<{ text: string; issues: SpellingSuggestion[] }> = [];
let currentSentenceIndex = 0;
let aiReady = false;
let analysisVersion = 0;
let lastAnalyzedText = '';

// Track pending changes to apply all at once
let pendingChanges: Array<{ original: string; replacement: string }> = [];
let acceptedCount = 0;
let ignoredCount = 0;
let targetElement: HTMLElement | null = null; // Store element reference for applying changes later

// =============================================================================
// Initialization
// =============================================================================

export default defineContentScript({
  matches: ['<all_urls>'],

  async main() {
    console.log('[LexiLens] Content script initialized - Status Bar Mode');

    settings = await loadSettings();

    if (settings.correctionEnabled) {
      initializeStatusBarSystem();
    }

    if (settings.dyslexicFontEnabled) {
      enableDyslexicFont();
    }

    initAIEngine();

    onSettingsChange((newSettings) => {
      const prevSettings = settings;
      settings = newSettings;

      if (newSettings.correctionEnabled !== prevSettings?.correctionEnabled) {
        newSettings.correctionEnabled ? initializeStatusBarSystem() : destroyStatusBarSystem();
      }

      if (newSettings.dyslexicFontEnabled !== prevSettings?.dyslexicFontEnabled) {
        newSettings.dyslexicFontEnabled ? enableDyslexicFont() : disableDyslexicFont();
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
  if (document.getElementById('lexilens-font-faces')) return;

  const style = document.createElement('style');
  style.id = 'lexilens-font-faces';
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
  injectFontFaces();
  document.documentElement.classList.add('lexilens-dyslexic-font');
  console.log('[LexiLens] Dyslexic font enabled');
}

function disableDyslexicFont(): void {
  document.documentElement.classList.remove('lexilens-dyslexic-font');
  console.log('[LexiLens] Dyslexic font disabled');
}

// =============================================================================
// AI Engine
// =============================================================================

async function initAIEngine(): Promise<void> {
  if (!settings) {
    console.log('[LexiLens AI Init] ❌ No settings available');
    return;
  }

  console.log('[LexiLens AI Init] ========== AI INITIALIZATION ==========');
  console.log('[LexiLens AI Init] Backend:', settings.ai.backend);

  if (!aiEngineModule) {
    try {
      aiEngineModule = await import('../../utils/ai-engine');
      console.log('[LexiLens AI Init] ✅ AI engine module loaded');
    } catch (e) {
      console.error('[LexiLens AI Init] ❌ Failed to load AI engine:', e);
      return;
    }
  }

  if (settings.ai.backend === 'browser') {
    if (!settings.ai.modelDownloaded) {
      console.log('[LexiLens AI Init] ⚠️  Model not downloaded');
      aiReady = false;
      return;
    }

    const hasWebGPU = await aiEngineModule.checkWebGPUSupport();
    if (!hasWebGPU) {
      console.log('[LexiLens AI Init] ❌ WebGPU not supported');
      aiReady = false;
      return;
    }

    const success = await aiEngineModule.initBrowserAI(settings.ai.browserModelId);
    aiReady = success;
    console.log('[LexiLens AI Init]', success ? '✅ READY' : '❌ FAILED');
  } else {
    const available = await aiEngineModule.checkOllamaAvailable(settings.ai.ollamaEndpoint);
    aiReady = available;
    console.log('[LexiLens AI Init] Ollama:', available ? '✅ AVAILABLE' : '❌ UNAVAILABLE');
  }

  console.log('[LexiLens AI Init] Final Status:', aiReady ? '✅ READY' : '❌ NOT READY');
  console.log('[LexiLens AI Init] ========================================');
}

// =============================================================================
// Status Bar System
// =============================================================================

function initializeStatusBarSystem(): void {
  if (!statusBar) {
    statusBar = document.createElement('div');
    statusBar.id = 'lexilens-status-bar';
    statusBar.className = 'hidden';
    statusBar.innerHTML = `
      <div class="lexilens-status-icon">✍️</div>
      <div class="lexilens-status-content">
        <div class="lexilens-status-title">LexiLens</div>
        <div class="lexilens-status-counts"></div>
      </div>
    `;
    statusBar.addEventListener('click', openReviewModal);
    document.body.appendChild(statusBar);
  }

  if (!reviewModal) {
    reviewModal = document.createElement('div');
    reviewModal.id = 'lexilens-review-modal';
    reviewModal.innerHTML = `
      <div class="lexilens-modal-content">
        <div class="lexilens-modal-header">
          <div class="lexilens-modal-title">
            <span>📝</span>
            <span>Review Suggestions</span>
          </div>
          <button class="lexilens-modal-close">✕</button>
        </div>
        <div class="lexilens-modal-body"></div>
        <div class="lexilens-modal-footer">
          <div class="lexilens-modal-progress"></div>
          <div class="lexilens-modal-nav">
            <button class="lexilens-nav-btn" data-action="prev">← Previous</button>
            <button class="lexilens-nav-btn" data-action="next">Next →</button>
            <button class="lexilens-nav-btn" data-action="done">Done</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(reviewModal);

    reviewModal.querySelector('.lexilens-modal-close')?.addEventListener('click', closeReviewModal);
    reviewModal.addEventListener('click', (e) => {
      if (e.target === reviewModal) closeReviewModal();
    });

    reviewModal.querySelector('[data-action="prev"]')?.addEventListener('click', () => navigateSentence(-1));
    reviewModal.querySelector('[data-action="next"]')?.addEventListener('click', () => navigateSentence(1));
    reviewModal.querySelector('[data-action="done"]')?.addEventListener('click', closeReviewModal);
  }

  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  document.addEventListener('input', handleInput, true);

  console.log('[LexiLens] Status bar system initialized');
}

function destroyStatusBarSystem(): void {
  document.removeEventListener('focusin', handleFocusIn, true);
  document.removeEventListener('focusout', handleFocusOut, true);
  document.removeEventListener('input', handleInput, true);

  if (statusBar) {
    statusBar.remove();
    statusBar = null;
  }

  if (reviewModal) {
    reviewModal.remove();
    reviewModal = null;
  }

  console.log('[LexiLens] Status bar system destroyed');
}

// =============================================================================
// Event Handlers
// =============================================================================

function handleFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement;

  if (isEditableElement(target)) {
    currentFocusedElement = target;
    console.log('[LexiLens] Focused:', target.tagName);

    const text = getElementText(target);
    if (text.length > 2) {
      debouncedAnalyze(text, target);
    }
  }
}

function handleFocusOut(event: FocusEvent): void {
  setTimeout(() => {
    if (document.activeElement !== currentFocusedElement) {
      hideStatusBar();
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
    if (text.length > 2) {
      debouncedAnalyze(text, target);
    } else {
      hideStatusBar();
      lastAnalyzedText = '';
    }
  }
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
  if (text === lastAnalyzedText) return;

  const thisVersion = ++analysisVersion;
  lastAnalyzedText = text;

  console.log('\n[LexiLens] 📝 Analyzing:', text.substring(0, 60) + '...');

  let suggestions: SpellingSuggestion[] = [];

  // Try AI first
  if (aiReady && aiEngineModule && settings) {
    try {
      suggestions = await aiEngineModule.analyzeWithAI(text, settings.ai);
      console.log('[LexiLens] AI found', suggestions.length, 'issues');
    } catch (error) {
      console.error('[LexiLens] AI error:', error);
    }
  }

  // Fallback to local
  if (suggestions.length === 0) {
    suggestions = analyzeTextLocal(text);
    console.log('[LexiLens] Local found', suggestions.length, 'issues');
  }

  // Check for stale results
  if (thisVersion !== analysisVersion) {
    console.log('[LexiLens] Stale result, discarding');
    return;
  }

  currentSuggestions = suggestions;

  if (suggestions.length > 0) {
    organizeIntoSentences(text, suggestions);
    updateStatusBar(suggestions);
  } else {
    hideStatusBar();
  }
}

function organizeIntoSentences(text: string, suggestions: SpellingSuggestion[]): void {
  // Split text into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  console.log('[LexiLens] Split into', sentences.length, 'sentences');

  currentSentences = sentences.map(sentence => {
    const sentenceStart = text.indexOf(sentence);
    const sentenceEnd = sentenceStart + sentence.length;

    // Find issues in this sentence
    const issues = suggestions.filter(s =>
      s.position.start >= sentenceStart && s.position.end <= sentenceEnd
    );

    return {
      text: sentence.trim(),
      issues
    };
  }).filter(s => s.issues.length > 0); // Only sentences with issues

  console.log('[LexiLens] Found', currentSentences.length, 'sentences with issues');
}

// =============================================================================
// Status Bar
// =============================================================================

function updateStatusBar(suggestions: SpellingSuggestion[]): void {
  if (!statusBar || !currentFocusedElement) return;

  // Count by category
  const counts = {
    purple: 0,
    yellow: 0,
    blue: 0,
    orange: 0,
    green: 0
  };

  suggestions.forEach(s => {
    const cat = s.category as keyof typeof counts;
    if (counts[cat] !== undefined) counts[cat]++;
  });

  const countsHtml = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([category, count]) => `
      <span class="lexilens-status-badge ${category}">
        ${count}
      </span>
    `).join('');

  const countsContainer = statusBar.querySelector('.lexilens-status-counts');
  if (countsContainer) {
    countsContainer.innerHTML = countsHtml;
  }

  // Position near the focused element (top-right corner)
  const rect = currentFocusedElement.getBoundingClientRect();
  const padding = 8;

  // Position at top-right of the input field
  const left = rect.right - 200; // 200px width of status bar
  const top = rect.top - 50; // 50px above the input

  statusBar.style.left = `${Math.max(padding, left)}px`;
  statusBar.style.top = `${Math.max(padding, top)}px`;

  statusBar.classList.remove('hidden');
}

function hideStatusBar(): void {
  if (statusBar) {
    statusBar.classList.add('hidden');
  }
}

// =============================================================================
// Review Modal
// =============================================================================

function openReviewModal(): void {
  if (!reviewModal || currentSentences.length === 0) return;

  currentSentenceIndex = 0;
  pendingChanges = [];
  acceptedCount = 0;
  ignoredCount = 0;

  // Store the element reference so we can apply changes later
  targetElement = currentFocusedElement;
  console.log('[LexiLens] Stored target element:', targetElement?.tagName);

  reviewModal.classList.add('visible');
  renderCurrentSentence();
}

function closeReviewModal(): void {
  if (reviewModal) {
    reviewModal.classList.remove('visible');
  }

  // Apply all pending changes
  applyAllChanges();
}

function navigateSentence(direction: number): void {
  currentSentenceIndex += direction;
  currentSentenceIndex = Math.max(0, Math.min(currentSentences.length - 1, currentSentenceIndex));
  renderCurrentSentence();
}

function renderCurrentSentence(): void {
  if (!reviewModal) return;

  const body = reviewModal.querySelector('.lexilens-modal-body');
  const progress = reviewModal.querySelector('.lexilens-modal-progress');
  const prevBtn = reviewModal.querySelector('[data-action="prev"]') as HTMLButtonElement;
  const nextBtn = reviewModal.querySelector('[data-action="next"]') as HTMLButtonElement;

  if (!body || !progress) return;

  if (currentSentences.length === 0) {
    body.innerHTML = `
      <div class="lexilens-empty-state">
        <div class="lexilens-empty-icon">✨</div>
        <div class="lexilens-empty-title">All Clear!</div>
        <div class="lexilens-empty-desc">No spelling issues found</div>
      </div>
    `;
    return;
  }

  const sentence = currentSentences[currentSentenceIndex];

  // Highlight error words in sentence
  let highlightedText = sentence.text;
  sentence.issues.forEach(issue => {
    highlightedText = highlightedText.replace(
      issue.original,
      `<span class="error-word">${issue.original}</span>`
    );
  });

  // Generate AI hint based on issues
  const aiHint = generateAIHint(sentence.issues);

  body.innerHTML = `
    <div class="lexilens-sentence-container">
      <div class="lexilens-sentence-label">Sentence ${currentSentenceIndex + 1} of ${currentSentences.length}</div>
      <div class="lexilens-sentence-text">${highlightedText}</div>
      ${aiHint ? `
        <div class="lexilens-ai-hint">
          <div class="lexilens-ai-hint-title">💡 AI Insight</div>
          <div class="lexilens-ai-hint-text">${aiHint}</div>
        </div>
      ` : ''}
      <div class="lexilens-issues-list">
        ${sentence.issues.map((issue, idx) => {
          const confidencePercent = Math.round((issue.confidence || 0.9) * 100);
          const confidenceClass = confidencePercent >= 85 ? 'high' : confidencePercent >= 70 ? 'medium' : 'low';
          const showQuestion = issue.category === 'yellow' && issue.question && confidencePercent < 80;
          
          return `
          <div class="lexilens-issue-item ${issue.category}">
            <div class="lexilens-issue-header">
              <div class="lexilens-issue-word">
                <span class="lexilens-issue-original">${issue.original}</span>
                <span class="lexilens-issue-arrow">→</span>
                <span class="lexilens-issue-suggestion">${issue.suggestions[0]}</span>
              </div>
              <div class="lexilens-issue-meta">
                <span class="lexilens-issue-confidence ${confidenceClass}" title="AI Confidence: ${confidencePercent}%">
                  ${confidencePercent}%
                </span>
                <span class="lexilens-issue-category-badge ${issue.category}">${getCategoryName(issue.category)}</span>
              </div>
            </div>
            ${showQuestion ? `
              <div class="lexilens-issue-question">
                <span class="question-icon">🤔</span>
                <span class="question-text">${issue.question}</span>
              </div>
            ` : ''}
            ${issue.tip ? `<div class="lexilens-issue-tip">${issue.tip}</div>` : ''}
            <div class="lexilens-issue-actions">
              ${issue.category === 'blue' ? `
                <button class="lexilens-issue-btn verify" data-index="${idx}" data-original="${issue.original}" data-replacement="${issue.suggestions[0]}">✓ Verify & Add to Dictionary</button>
                <button class="lexilens-issue-btn accept" data-index="${idx}" data-original="${issue.original}" data-replacement="${issue.suggestions[0]}">✓ Accept Fix</button>
              ` : issue.category === 'yellow' ? `
                <button class="lexilens-issue-btn accept" data-index="${idx}" data-original="${issue.original}" data-replacement="${issue.suggestions[0]}">✓ Accept "${issue.suggestions[0]}"</button>
                <button class="lexilens-issue-btn confirm-correct" data-index="${idx}" data-original="${issue.original}">✓ "${issue.original}" is Correct</button>
              ` : `
                <button class="lexilens-issue-btn accept" data-index="${idx}" data-original="${issue.original}" data-replacement="${issue.suggestions[0]}">✓ Accept</button>
                <button class="lexilens-issue-btn ignore" data-index="${idx}">✕ Ignore</button>
              `}
            </div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;

  // Attach event listeners
  body.querySelectorAll('.lexilens-issue-btn.accept').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const idx = parseInt(target.dataset.index || '0');
      const original = target.dataset.original || '';
      const replacement = target.dataset.replacement || '';
      console.log('[LexiLens] Accept clicked:', { idx, original, replacement });

      // Add visual feedback - animate the issue item
      const issueItem = target.closest('.lexilens-issue-item');
      if (issueItem) {
        issueItem.classList.add('accepted');
        setTimeout(() => {
          acceptSuggestion(sentence.issues[idx], original, replacement);
        }, 300); // Wait for animation
      } else {
        acceptSuggestion(sentence.issues[idx], original, replacement);
      }
    });
  });

  // Handle Verify & Add to Dictionary button for entities (blue category)
  body.querySelectorAll('.lexilens-issue-btn.verify').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const idx = parseInt(target.dataset.index || '0');
      const original = target.dataset.original || '';
      const replacement = target.dataset.replacement || '';
      console.log('[LexiLens] Verify & Add clicked:', { idx, original, replacement });

      // Add to verified entities in storage
      await addToVerifiedEntities(replacement);

      // Add visual feedback - animate the issue item
      const issueItem = target.closest('.lexilens-issue-item');
      if (issueItem) {
        issueItem.classList.add('verified');
        setTimeout(() => {
          acceptSuggestion(sentence.issues[idx], original, replacement);
        }, 300); // Wait for animation
      } else {
        acceptSuggestion(sentence.issues[idx], original, replacement);
      }
    });
  });

  // Handle Confirm Correct button for homophones (yellow category)
  // This adds the original word to validated homophones so it won't be flagged again
  body.querySelectorAll('.lexilens-issue-btn.confirm-correct').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const idx = parseInt(target.dataset.index || '0');
      const original = target.dataset.original || '';
      console.log('[LexiLens] Confirm Correct clicked:', { idx, original });

      // Add to validated homophones in storage
      await addToValidatedHomophones(original);

      // Add visual feedback - animate the issue item
      const issueItem = target.closest('.lexilens-issue-item');
      if (issueItem) {
        issueItem.classList.add('confirmed');
        setTimeout(() => {
          // Just dismiss the issue, don't change the text
          dismissIssue(sentence.issues[idx]);
        }, 300); // Wait for animation
      } else {
        dismissIssue(sentence.issues[idx]);
      }
    });
  });

  body.querySelectorAll('.lexilens-issue-btn.ignore').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.index || '0');
      ignoreSuggestion(sentence.issues[idx]);
    });
  });

  // Update progress and navigation
  const stats = acceptedCount > 0 || ignoredCount > 0
    ? ` • ✓ ${acceptedCount} accepted • ✕ ${ignoredCount} ignored`
    : '';
  progress.textContent = `Sentence ${currentSentenceIndex + 1} of ${currentSentences.length}${stats}`;

  if (prevBtn) prevBtn.disabled = currentSentenceIndex === 0;
  if (nextBtn) nextBtn.disabled = currentSentenceIndex === currentSentences.length - 1;
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    purple: 'Spelling',
    yellow: 'Homophone',
    blue: 'Verify Identity',
    orange: 'Typo',
    green: 'Suggestion'
  };
  return names[category] || 'Issue';
}

function generateAIHint(issues: SpellingSuggestion[]): string {
  if (issues.length === 0) return '';

  // Count by category
  const counts = issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Generate contextual hints
  const hints = [];

  if (counts['purple']) {
    hints.push(`Found ${counts['purple']} spelling ${counts['purple'] === 1 ? 'error' : 'errors'} - you're doing great at catching these!`);
  }

  if (counts['yellow']) {
    hints.push(`${counts['yellow']} word${counts['yellow'] === 1 ? ' sounds' : 's sound'} like another - choose the right meaning.`);
  }

  if (counts['blue']) {
    hints.push(`${counts['blue']} name${counts['blue'] === 1 ? '' : 's'} or acronym${counts['blue'] === 1 ? '' : 's'} to verify.`);
  }

  if (hints.length === 0) {
    return "Great job! These are minor fixes that will make your writing even clearer.";
  }

  return hints.join(' ') + " 💪 You've got this!";
}

/**
 * Add a verified entity to the dictionary in storage
 * This will persist across sessions and pages
 */
async function addToVerifiedEntities(entity: string): Promise<void> {
  if (!settings || !entity.trim()) return;

  const currentEntities = settings.ai.verifiedEntities || [];

  // Check if already exists (case-insensitive)
  if (currentEntities.some(e => e.toLowerCase() === entity.toLowerCase())) {
    console.log('[LexiLens] Entity already in dictionary:', entity);
    return;
  }

  const newEntities = [...currentEntities, entity.trim()];
  const updatedAI = { ...settings.ai, verifiedEntities: newEntities };
  const updatedSettings = { ...settings, ai: updatedAI };

  // Update local state
  settings = updatedSettings;

  // Persist to storage
  await updateSettings({ ai: updatedAI });

  // Broadcast to other parts of the extension (popup, etc.)
  await broadcastSettingsUpdate({ ai: updatedAI });

  console.log('[LexiLens] ✅ Added to verified entities:', entity);
  console.log('[LexiLens] Current verified entities:', newEntities);
}

/**
 * Add a validated homophone to storage
 * This prevents the word from being flagged as a homophone error in the future
 */
async function addToValidatedHomophones(word: string): Promise<void> {
  if (!settings || !word.trim()) return;

  const currentHomophones = settings.ai.validatedHomophones || [];

  // Check if already exists (case-insensitive)
  if (currentHomophones.some((h: string) => h.toLowerCase() === word.toLowerCase())) {
    console.log('[LexiLens] Homophone already validated:', word);
    return;
  }

  const newHomophones = [...currentHomophones, word.trim()];
  const updatedAI = { ...settings.ai, validatedHomophones: newHomophones };

  // Update local state
  settings = { ...settings, ai: updatedAI };

  // Persist to storage
  await updateSettings({ ai: updatedAI });

  // Broadcast to other parts of the extension (popup, etc.)
  await broadcastSettingsUpdate({ ai: updatedAI });

  console.log('[LexiLens] ✅ Added to validated homophones:', word);
  console.log('[LexiLens] Current validated homophones:', newHomophones);
}

/**
 * Dismiss an issue without making any text changes
 * Used when user confirms the original word is correct
 */
function dismissIssue(issue: SpellingSuggestion): void {
  console.log('[LexiLens] Dismissing issue (no change):', issue.original);

  // Just remove from current sentence without changing text
  const sentence = currentSentences[currentSentenceIndex];
  sentence.issues = sentence.issues.filter(i => i !== issue);

  if (sentence.issues.length === 0) {
    currentSentences.splice(currentSentenceIndex, 1);
    if (currentSentenceIndex >= currentSentences.length) {
      currentSentenceIndex = Math.max(0, currentSentences.length - 1);
    }
  }

  if (currentSentences.length === 0) {
    console.log('[LexiLens] All issues reviewed!');
    closeReviewModal();
    hideStatusBar();
  } else {
    renderCurrentSentence();
  }
}

function acceptSuggestion(issue: SpellingSuggestion, original: string, replacement: string): void {
  console.log('[LexiLens] Queuing change:', { original, replacement });

  // Add to pending changes
  pendingChanges.push({ original, replacement });
  acceptedCount++;

  // Update the sentence text in the UI immediately to show the change
  const sentence = currentSentences[currentSentenceIndex];
  sentence.text = sentence.text.replace(new RegExp(`\\b${escapeRegex(original)}\\b`, 'i'), replacement);

  // Remove from current sentence
  sentence.issues = sentence.issues.filter(i => i !== issue);

  if (sentence.issues.length === 0) {
    // Move to next sentence or close if done
    currentSentences.splice(currentSentenceIndex, 1);
    if (currentSentenceIndex >= currentSentences.length) {
      currentSentenceIndex = Math.max(0, currentSentences.length - 1);
    }
  }

  if (currentSentences.length === 0) {
    console.log('[LexiLens] 🎉 All issues reviewed! Applying', pendingChanges.length, 'changes...');
    closeReviewModal();
    hideStatusBar();
  } else {
    renderCurrentSentence();
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ignoreSuggestion(issue: SpellingSuggestion): void {
  console.log('[LexiLens] Ignoring:', issue.original);

  ignoredCount++;

  const sentence = currentSentences[currentSentenceIndex];
  sentence.issues = sentence.issues.filter(i => i !== issue);

  if (sentence.issues.length === 0) {
    currentSentences.splice(currentSentenceIndex, 1);
    if (currentSentenceIndex >= currentSentences.length) {
      currentSentenceIndex = Math.max(0, currentSentences.length - 1);
    }
  }

  if (currentSentences.length === 0) {
    console.log('[LexiLens] All issues reviewed!');
    closeReviewModal();
    hideStatusBar();
  } else {
    renderCurrentSentence();
  }
}

function applyAllChanges(): void {
  if (pendingChanges.length === 0) {
    console.log('[LexiLens] No changes to apply');
    return;
  }

  // Use the stored target element instead of currentFocusedElement
  const element = targetElement || currentFocusedElement;

  if (!element) {
    console.error('[LexiLens] ❌ No target element to apply changes to!');
    console.error('[LexiLens] targetElement:', targetElement);
    console.error('[LexiLens] currentFocusedElement:', currentFocusedElement);
    return;
  }

  console.log('[LexiLens] 🔄 Applying', pendingChanges.length, 'changes to', element.tagName);
  console.log('[LexiLens] Pending changes:', JSON.stringify(pendingChanges, null, 2));

  const isInput = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
  let currentText = getElementText(element);

  console.log('[LexiLens] Original text (', currentText.length, 'chars):', currentText);

  // Apply all changes in sequence
  let appliedCount = 0;
  pendingChanges.forEach((change, index) => {
    console.log(`[LexiLens] Processing change ${index + 1}:`, change);

    // Try to find the word (case-insensitive, whole word)
    const escapedOriginal = escapeRegex(change.original);
    const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'i');

    console.log(`[LexiLens] Searching for regex: \\b${escapedOriginal}\\b`);
    const match = regex.exec(currentText);

    if (match) {
      console.log(`[LexiLens] ✓ Found at position ${match.index}`);
      const before = currentText.substring(0, match.index);
      const after = currentText.substring(match.index + match[0].length);
      currentText = before + change.replacement + after;
      console.log(`[LexiLens] ✓ ${index + 1}. "${change.original}" → "${change.replacement}" APPLIED`);
      appliedCount++;
    } else {
      // Try case-sensitive search without word boundaries as fallback
      const simpleIndex = currentText.indexOf(change.original);
      if (simpleIndex !== -1) {
        console.log(`[LexiLens] ✓ Found with simple search at position ${simpleIndex}`);
        const before = currentText.substring(0, simpleIndex);
        const after = currentText.substring(simpleIndex + change.original.length);
        currentText = before + change.replacement + after;
        console.log(`[LexiLens] ✓ ${index + 1}. "${change.original}" → "${change.replacement}" APPLIED (fallback)`);
        appliedCount++;
      } else {
        console.error(`[LexiLens] ❌ ${index + 1}. Could not find "${change.original}" in text`);
        console.error(`[LexiLens] Text snapshot:`, currentText.substring(0, 200));
      }
    }
  });

  console.log('[LexiLens] Applied', appliedCount, 'out of', pendingChanges.length, 'changes');
  console.log('[LexiLens] Final text (', currentText.length, 'chars):', currentText);

  // Update the element
  if (isInput) {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const oldValue = input.value;
    input.value = currentText;
    console.log('[LexiLens] Updated input value');
    console.log('[LexiLens] Old:', oldValue);
    console.log('[LexiLens] New:', input.value);

    // Verify it was actually updated
    setTimeout(() => {
      console.log('[LexiLens] Verification - Current value:', input.value);
    }, 100);

    input.focus();
  } else {
    const oldText = element.innerText;
    element.innerText = currentText;
    console.log('[LexiLens] Updated contentEditable');
    console.log('[LexiLens] Old:', oldText);
    console.log('[LexiLens] New:', element.innerText);
    element.focus();
  }

  // Trigger events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  console.log('[LexiLens] ✅ All', appliedCount, 'changes applied successfully!');

  // Clear pending changes and target element
  pendingChanges = [];
  targetElement = null;

  // Trigger re-analysis
  lastAnalyzedText = '';
  setTimeout(() => {
    if (element) {
      debouncedAnalyze(currentText, element);
    }
  }, 100);
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
  if (message.type === 'SETTINGS_UPDATED' && message.payload) {
    settings = { ...settings, ...message.payload } as LexiLensSettings;
  }
}

