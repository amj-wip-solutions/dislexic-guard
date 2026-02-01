# ✨ LexiLens - Dyslexia Writing Assistant

**A Grammarly-style browser extension that highlights and fixes dyslexia-specific spelling mistakes as you type.**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Firefox-orange)

---

## 🎯 What It Does

LexiLens watches what you type and **underlines words** that match common dyslexia spelling patterns. Click an underlined word to see suggestions and fix it with one click.

### Example
```
You type: "I want to go their with my frend"
                          ─────        ─────
LexiLens underlines:      "their"      "frend"
                             ↓            ↓  
Suggests:               "there"      "friend"
```

---

## ✨ Features

### 🔍 Smart Detection
- **100+ dyslexia-specific patterns** - Common mistakes like "frend" → "friend"
- **Phonetic matching** - Understands words spelled how they sound
- **Letter reversal detection** - Catches b/d, p/q confusions
- **Homophone awareness** - Flags their/there/they're, your/you're

### 🎨 Non-Intrusive UI
- **Subtle underlines** - Orange highlights under problem words
- **Click to fix** - Beautiful popup with suggestions
- **One-click corrections** - Select a suggestion to apply it instantly

### 🔒 Privacy First
- **Local processing** - Dictionary runs entirely on your device
- **No data collection** - Nothing leaves your browser
- **Optional AI** - OpenAI integration available but not required

---

## 🚀 Quick Start

### Install from Source

```bash
# Clone the repo
git clone https://github.com/yourusername/lexi-lens.git
cd lexi-lens

# Install dependencies
npm install

# Build the extension
npm run build

# The extension is ready in the 'dist' folder
```

### Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist` folder from the project

### Load in Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select any file in the `dist` folder

---

## 📖 How to Use

1. **Click the LexiLens icon** in your browser toolbar to open settings
2. **Make sure it's enabled** (toggle should be ON)
3. **Start typing** in any text field on any website
4. **Watch for orange underlines** - these are potential issues
5. **Click an underline** to see suggestions
6. **Click a suggestion** to apply the fix

### Supported Text Fields
- ✅ Regular text inputs
- ✅ Textareas
- ✅ Gmail composer
- ✅ Google Docs (limited)
- ✅ Facebook posts
- ✅ Any `contenteditable` element

---

## 📁 Project Structure

```
lexi-lens/
├── entrypoints/
│   ├── background.ts          # Service worker (AI logic)
│   ├── content/
│   │   ├── index.ts           # Main content script (highlighting)
│   │   └── style.css          # Underline & popup styles
│   └── popup/
│       ├── App.tsx            # Settings UI (React)
│       └── App.css            # Purple theme styles
│
├── utils/
│   ├── debounce.ts            # Debounce utility (500ms)
│   ├── phonetic-engine.ts     # Local dictionary & analysis
│   ├── messages.ts            # Content ↔ Background bridge
│   └── storage.ts             # Settings persistence
│
├── types/
│   └── index.ts               # TypeScript interfaces
│
├── wxt.config.ts              # WXT configuration
└── package.json
```

---

## 🧠 The Phonetic Engine

The local dictionary includes 100+ common dyslexia-specific misspellings:

### Letter Reversals
| Typed | Corrected |
|-------|-----------|
| doy | boy |
| dag | bag |
| qark | park |

### Phonetic Spellings
| Typed | Corrected |
|-------|-----------|
| frend | friend |
| sed | said |
| becuase | because |
| wich | which |
| definately | definitely |

### Homophones
The engine flags these for review (context-dependent):
- their / there / they're
- your / you're
- its / it's
- to / too / two

---

## ⚙️ Settings

Click the LexiLens icon to access settings:

| Setting | Description |
|---------|-------------|
| **Enable LexiLens** | Turn highlighting on/off |
| **Correction Engine** | Choose Local Dictionary or AI-Powered |
| **API Key** | Required for OpenAI mode |

---

## 🔧 Development

### Available Commands

```bash
npm run dev          # Start dev server (Chrome)
npm run dev:firefox  # Start dev server (Firefox)
npm run build        # Production build (Chrome)
npm run build:firefox # Production build (Firefox)
npm run zip          # Create distributable ZIP
```

### Adding New Words to Dictionary

Edit `utils/phonetic-engine.ts`:

```typescript
const DYSLEXIA_DICTIONARY = new Map([
  // Add your patterns here
  ['youre', "you're"],
  ['wierd', 'weird'],
]);
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Types Text                       │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Content Script (content.ts)                 │
│  • Watches input/textarea/contenteditable elements      │
│  • Debounces input (500ms)                              │
│  • Calls phonetic-engine for analysis                   │
│  • Renders underline highlights                         │
│  • Shows suggestion popup on click                      │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│            Phonetic Engine (phonetic-engine.ts)          │
│  • 100+ dyslexia patterns                               │
│  • Phonetic similarity matching                         │
│  • Returns: { word, suggestions, confidence, position } │
└─────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Background Script (optional AI)                │
│  • Calls OpenAI API if configured                       │
│  • Merges AI + local suggestions                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run `npm run build` to verify
5. Submit a Pull Request

### Ideas for Contributions
- Add more words to the dictionary
- Improve detection for specific languages
- Add "ignore word" feature
- Add personal dictionary support

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Built with [WXT](https://wxt.dev/) framework
- Inspired by Grammarly's UX
- Made for the dyslexia community

---

<p align="center">
  <strong>Made with ❤️ for dyslexic writers everywhere</strong>
</p>

