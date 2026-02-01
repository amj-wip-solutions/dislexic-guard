# LexiLens - Dyslexia-Focused Writing Assistant

## 📋 Product Overview

**LexiLens** is a high-performance browser extension designed to assist users with dyslexia in reading and writing across the web. Built with the WXT (Web Extension Toolbox) framework and TypeScript, it provides real-time visual aids and intelligent text correction without disrupting the user's browsing experience.

---

## 🎯 Target Users

- Individuals with dyslexia who struggle with reading long passages
- Writers who need phonetic-aware spelling assistance
- Anyone who benefits from visual reading aids

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Extension                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    Messages    ┌──────────────────────┐   │
│  │   content.ts     │◄──────────────►│   background.ts      │   │
│  │   (DOM Layer)    │                │   (Service Worker)   │   │
│  │                  │                │                      │   │
│  │  • Reading Ruler │                │  • AI/LLM Logic      │   │
│  │  • Text Capture  │                │  • Heavy Processing  │   │
│  │  • UI Overlays   │                │  • Storage Sync      │   │
│  └──────────────────┘                └──────────────────────┘   │
│           │                                    │                 │
│           │                                    │                 │
│           ▼                                    ▼                 │
│  ┌──────────────────┐                ┌──────────────────────┐   │
│  │   styles.css     │                │ chrome.storage.local │   │
│  │   (Visual Layer) │                │   (User Settings)    │   │
│  └──────────────────┘                └──────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Features

### A. Reading Ruler (Visual UI)

**Purpose:** Provides a semi-transparent colored band that follows the mouse cursor, helping users focus on one line of text at a time.

**Implementation:**
- Inject a non-destructive `<div>` into the DOM via `content.ts`
- Follow mouse cursor vertically across the viewport
- Use CSS `pointer-events: none` to prevent interaction blocking
- Apply `mix-blend-mode: multiply` for better readability
- Toggle ON/OFF via popup or keyboard shortcut

**User Experience:**
- Activates on page load (if enabled in settings)
- Smooth vertical tracking with mouse movement
- Configurable height, color, and opacity

### B. Universal Text Capture (The "Eyes")

**Purpose:** Monitor user input across all web forms and rich text editors.

**Implementation:**
- Listen for `input` events on `<input>` and `<textarea>` elements
- Use `MutationObserver` for `contenteditable` elements (Gmail, Facebook, etc.)
- Only observe the **actively focused** element for performance
- 1000ms debounce to trigger analysis only when user pauses typing

**Supported Platforms:**
- Standard HTML forms
- Gmail composer
- Facebook posts
- Google Docs (limited)
- Any contenteditable div

### C. Phonetic Correction Engine (The "Brain")

**Purpose:** Provide intelligent spelling suggestions based on phonetic similarity, not just edit distance.

**Implementation:**
1. **Local Dictionary (Instant):**
   - Common dyslexia-specific swaps (e.g., "frend" → "friend")
   - Phonetically confused pairs (e.g., "their/there/they're")
   - Letter reversal patterns (b/d, p/q)

2. **AI-Powered (Async):**
   - Send text to background service worker
   - Background worker calls LLM API (OpenAI or local)
   - System prompt prioritizes phonetic similarity
   - Returns suggestions to content script

### D. Non-Destructive UI Highlights

**Purpose:** Visually indicate problematic words without modifying the page's HTML.

**Implementation:**
- Calculate word positions using `getBoundingClientRect()`
- Create absolute-positioned overlay divs
- Apply "dyslexia-friendly" orange squiggles
- Updates position on scroll/resize
- Clean up on focus change

---

## 📁 File Structure

```
lexi-lens/
├── docs/
│   └── PLANNING.md              # This document
├── entrypoints/
│   ├── background.ts            # Service worker (AI logic, storage)
│   ├── content.ts               # Main content script
│   ├── content/
│   │   ├── index.ts             # Content script entry
│   │   └── style.css            # Injected styles
│   └── popup/
│       ├── App.tsx              # Settings UI
│       ├── App.css              # Popup styles
│       ├── index.html           # Popup HTML
│       └── main.tsx             # React entry
├── utils/
│   ├── debounce.ts              # Debounce utility
│   ├── phonetic-engine.ts       # Local phonetic dictionary
│   ├── messages.ts              # Type-safe messaging
│   └── storage.ts               # Settings management
├── types/
│   └── index.ts                 # TypeScript interfaces
├── assets/
│   └── ...                      # Icons and images
├── public/
│   └── icon/                    # Extension icons
├── wxt.config.ts                # WXT configuration
├── package.json
└── tsconfig.json
```

---

## 🔧 Technical Specifications

### TypeScript Interfaces

```typescript
// User Settings
interface LexiLensSettings {
  rulerEnabled: boolean;
  rulerColor: string;
  rulerOpacity: number;
  rulerHeight: number;
  correctionEnabled: boolean;
  aiProvider: 'openai' | 'local' | 'none';
  apiKey?: string;
}

// Correction Suggestion
interface SpellingSuggestion {
  original: string;
  suggestions: string[];
  confidence: number;
  source: 'local' | 'ai';
  position: { start: number; end: number };
}

// Message Types
type MessageType = 
  | { type: 'ANALYZE_TEXT'; payload: string }
  | { type: 'ANALYSIS_RESULT'; payload: SpellingSuggestion[] }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<LexiLensSettings> };
```

### Performance Constraints

| Constraint | Implementation |
|------------|----------------|
| No main thread blocking | Heavy analysis in service worker |
| Focused element only | Single MutationObserver instance |
| Debounced triggers | 1000ms delay after typing stops |
| Lazy initialization | Ruler created on first mouse move |
| Cleanup on navigation | Remove observers and overlays |

### Privacy Considerations

- All local dictionary lookups happen client-side
- AI calls are opt-in and configurable
- No data stored beyond user settings
- API keys stored in `chrome.storage.local` (encrypted by browser)

---

## 🚀 Deployment & Usage

### Installation (Development)

```bash
# Clone and install
cd lexi-lens
npm install

# Run in development mode (Chrome)
npm run dev

# Run in development mode (Firefox)
npm run dev:firefox
```

### Installation (Production)

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox

# Create distributable ZIP
npm run zip
```

### User Guide

1. **Install the extension** from Chrome Web Store or Firefox Add-ons
2. **Pin the extension** to the toolbar for easy access
3. **Click the icon** to open settings popup
4. **Enable Reading Ruler** - a colored band follows your mouse
5. **Enable Corrections** - type in any text field to see suggestions
6. **Configure AI** (optional) - add API key for enhanced suggestions

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+R` | Toggle Reading Ruler |
| `Alt+L` | Toggle LexiLens completely |

---

## 📅 Implementation Phases

### Phase 1: Foundation ✅ (Current)
- [x] Project setup with WXT
- [x] Basic debounce utility
- [x] Phonetic engine skeleton

### Phase 2: Reading Ruler 🔄
- [ ] Ruler DOM injection
- [ ] Mouse tracking
- [ ] CSS styling
- [ ] Settings persistence

### Phase 3: Text Capture
- [ ] Input/textarea monitoring
- [ ] ContentEditable support
- [ ] Focus-aware observation
- [ ] Debounced triggers

### Phase 4: Correction Engine
- [ ] Local dictionary
- [ ] Overlay highlights
- [ ] Message bridge
- [ ] AI integration (optional)

### Phase 5: Polish
- [ ] Popup settings UI
- [ ] Keyboard shortcuts
- [ ] Performance optimization
- [ ] Cross-browser testing

---

## 🔗 Dependencies

| Package | Purpose |
|---------|---------|
| `wxt` | Extension framework |
| `react` | Popup UI |
| `typescript` | Type safety |

---

## 📝 Notes for Developers

- Always use strict TypeScript interfaces for message passing
- Test on Gmail, Facebook, and Google Docs specifically
- The Reading Ruler must never block page interactions
- Performance is critical - profile regularly
- Support both Chrome and Firefox from the start

