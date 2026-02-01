# LexiLens - Product Planning Document

## 📋 Overview

**LexiLens** is a Grammarly-style browser extension designed specifically for people with dyslexia. It monitors text input across all websites and highlights potential spelling issues using a phonetic-aware correction engine.

---

## 🎯 Problem Statement

People with dyslexia often struggle with:
- **Phonetic spelling** - Writing words as they sound ("frend" instead of "friend")
- **Letter reversals** - Confusing b/d, p/q, m/w
- **Homophones** - Mixing up their/there/they're, your/you're
- **Double letters** - Missing or adding extra letters

Traditional spell checkers don't understand these patterns because they use edit-distance algorithms instead of phonetic matching.

---

## 💡 Solution

LexiLens provides:
1. **Inline highlighting** - Underlines problem words as you type
2. **Phonetic-first suggestions** - Prioritizes sound-alike corrections
3. **One-click fixes** - Click underline → click suggestion → done
4. **Optional AI enhancement** - OpenAI for context-aware corrections

---

## 🏗️ Architecture

### High-Level Flow

```
User Types → Content Script → Debounce (500ms) → Phonetic Engine → Highlights
                                                         ↓
                                              [Optional] Background Script
                                                         ↓
                                                   OpenAI API
```

### Components

#### 1. Content Script (`entrypoints/content/index.ts`)
**Responsibility:** DOM interaction, highlighting, user interaction

- Listens for `focusin` events on editable elements
- Captures text via `input` events
- Debounces analysis (500ms delay)
- Renders highlight overlays using absolute positioning
- Shows suggestion popup on highlight click
- Applies corrections to the text field

#### 2. Phonetic Engine (`utils/phonetic-engine.ts`)
**Responsibility:** Local, instant spelling analysis

- Contains 100+ dyslexia-specific word mappings
- Analyzes text word-by-word
- Returns suggestions with confidence scores
- Preserves original word casing in corrections

#### 3. Background Script (`entrypoints/background.ts`)
**Responsibility:** AI integration, settings management

- Handles OpenAI API calls (when enabled)
- Manages settings via `browser.storage.local`
- Broadcasts settings changes to all tabs

#### 4. Popup UI (`entrypoints/popup/App.tsx`)
**Responsibility:** User settings interface

- Toggle extension on/off
- Choose correction engine (local vs AI)
- Enter OpenAI API key
- Shows "how it works" instructions

---

## 📊 Data Flow

### Text Analysis Flow

```
1. User focuses on input field
2. User types text
3. Content script captures text
4. Debounce waits 500ms for pause
5. Phonetic engine analyzes text
6. Engine returns: [{ original, suggestions, confidence, position }]
7. Content script renders highlights at word positions
8. User clicks highlight
9. Popup shows suggestions
10. User clicks suggestion
11. Content script replaces word in field
12. Re-analyze with new text
```

### Settings Flow

```
1. User opens popup
2. User changes setting
3. Popup calls updateSettings()
4. Storage updated via browser.storage.local
5. broadcastSettingsUpdate() sends to all tabs
6. Content scripts receive SETTINGS_UPDATED message
7. Content scripts apply new settings
```

---

## 🎨 UI Design

### Highlight Style
- **Color:** Orange gradient (`#FF6B35` to `#FF8C42`)
- **Position:** 3px underline below word
- **Interaction:** Pointer cursor, scales on hover

### Suggestion Popup
- **Theme:** Purple gradient (matches popup)
- **Layout:** Header → Original word → Suggestions → Dismiss
- **Primary suggestion:** Green background, top of list

### Popup Theme
- **Background:** Purple gradient (`#667eea` to `#764ba2`)
- **Cards:** White with 10% opacity
- **Toggles:** Green when active

---

## 📁 File Structure

```
lexi-lens/
├── entrypoints/
│   ├── background.ts           # Service worker
│   ├── content/
│   │   ├── index.ts            # Main content script
│   │   └── style.css           # Highlight & popup styles
│   └── popup/
│       ├── App.tsx             # Settings UI
│       ├── App.css             # Popup styles
│       ├── index.html          # HTML template
│       ├── main.tsx            # React entry
│       └── style.css           # Base styles
│
├── utils/
│   ├── debounce.ts             # Debounce utility
│   ├── messages.ts             # Message bridge types
│   ├── phonetic-engine.ts      # Local dictionary
│   └── storage.ts              # Settings persistence
│
├── types/
│   └── index.ts                # TypeScript definitions
│
├── public/
│   └── icon/                   # Extension icons
│
├── docs/
│   └── PLANNING.md             # This document
│
├── wxt.config.ts               # WXT configuration
├── tsconfig.json               # TypeScript config
└── package.json                # Dependencies
```

---

## 🔒 Security & Privacy

### Data Handling
- **Local processing:** Default mode uses local dictionary only
- **No telemetry:** Extension doesn't collect any data
- **Optional AI:** User must explicitly enable and provide API key

### Permissions
- `storage` - Save user settings
- `activeTab` - Access current tab for content script

### API Key Storage
- Stored in `browser.storage.local`
- Encrypted by browser
- Never transmitted except to OpenAI API

---

## 🚀 Deployment

### Development
```bash
npm install
npm run dev      # Chrome
npm run dev:firefox
```

### Production
```bash
npm run build    # Creates .output/chrome-mv3/
npm run zip      # Creates distributable ZIP
```

### Distribution
1. Chrome Web Store - Upload ZIP from `npm run zip`
2. Firefox Add-ons - Upload ZIP from `npm run zip:firefox`

---

## 📈 Future Enhancements

### Phase 2
- [ ] Personal dictionary (add words to ignore)
- [ ] "Ignore this word" option
- [ ] Statistics (words corrected, common mistakes)

### Phase 3
- [ ] Multi-language support
- [ ] Custom word lists
- [ ] Sync settings across devices

### Phase 4
- [ ] Local LLM support (Ollama)
- [ ] Voice input integration
- [ ] Mobile app companion

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Install extension in Chrome
- [ ] Open any website with text input
- [ ] Type a misspelled word (e.g., "frend")
- [ ] Verify underline appears
- [ ] Click underline
- [ ] Verify popup shows
- [ ] Click suggestion
- [ ] Verify word is replaced

### Test Words
```
frend → friend
becuase → because
wich → which
definately → definitely
thier → their
teh → the
```

---

## 📞 Support

- GitHub Issues: Bug reports and feature requests
- Email: support@lexilens.app

---

*Last updated: February 2025*

