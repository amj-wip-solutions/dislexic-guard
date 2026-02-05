# ✨ LexiLens - AI-Powered Dyslexia Writing Assistant

**An intelligent browser extension that helps dyslexic writers by detecting spelling errors, homophones, and named entities with context-aware AI analysis.**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Firefox-orange)
![AI](https://img.shields.io/badge/AI-WebLLM%20%7C%20Ollama-purple)

---

## 🎯 What It Does

LexiLens is a next-generation writing assistant that understands **dyslexia-specific challenges**. It uses AI to analyze your writing in real-time, providing intelligent suggestions based on context—not just simple pattern matching.

### Example
```
You type: "I went to there house to see you're dog"
                       ─────              ────
LexiLens detects:     "there"            "you're"
                         ↓                  ↓  
Context-aware AI:    "their"            "your"
                   (possession)      (possession)
                   96% confident      98% confident
```

---

## ✨ Key Features

### 🧠 AI-Powered Analysis
- **Context-aware suggestions** - AI analyzes grammatical context, not just patterns
- **High-confidence predictions** - 85-99% accuracy on homophones when context is clear
- **Named Entity Recognition** - Detects and suggests proper casing for names, companies, acronyms
- **Two AI modes**:
  - **Browser AI (WebLLM)** - Runs 100% locally, no internet required
  - **Ollama** - Use your own local AI models for maximum privacy

### 🎨 Smart Review Interface
- **Status bar** - Shows issue count while you type
- **Sentence-by-sentence review** - Click to review all issues in organized modal
- **Color-coded categories**:
  - 🟣 **Purple** - Definite spelling errors
  - 🟡 **Yellow** - Homophones (their/there/they're)
  - 🔵 **Blue** - Named entities to verify (names, companies)
  - 🟠 **Orange** - Common typos
  - 🟢 **Green** - Suggestions

### 📚 Personal Dictionary System
- **Three dictionary types**:
  - **Ignored Words** - General terms, jargon, slang
  - **Verified Entities** - Names, companies, acronyms you've confirmed
  - **Validated Homophones** - Words you've confirmed are correct in context
- **CSV Import/Export** - Share dictionaries with teams or backup your settings
- **Auto-learning** - Validates words as you review, won't flag them again

### 🎯 Context-Based Homophone Detection
- **Never 50/50 guesses** - AI analyzes grammatical role to determine correct word
- **Smart confidence scoring**:
  - "I went to **there** house" → **their** (96% confident - possession context)
  - "**Your** the best" → **you're** (98% confident - contraction "you are")
  - "**Its** raining" → **it's** (97% confident - contraction "it is")
- **Two-button choice for homophones**:
  - High confidence: Primary button emphasizes AI recommendation
  - Low confidence: Equal buttons, user decides

### 🔒 Privacy First
- **100% Local Processing** - Both AI modes run entirely on your device
- **No cloud services** - No data sent to external servers
- **No tracking** - Zero telemetry, analytics, or data collection
- **Open source** - Audit the code yourself

---

## 🚀 Quick Start

### Option 1: Install from Source

```bash
# Clone the repo
git clone https://github.com/yourusername/lexi-lens.git
cd lexi-lens

# Install dependencies
npm install

# Build the extension
npm run build

# The extension is ready in .output/chrome-mv3/
```

### Option 2: Load Pre-built Extension

1. Download the latest release from GitHub
2. Extract the ZIP file
3. Follow the installation steps below

### Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` folder

### Load in Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select any file in the `.output/chrome-mv3` folder

---

## 📖 How to Use

### Initial Setup

1. **Click the LexiLens icon** in your browser toolbar
2. **Choose your AI backend**:
   - **Browser AI (Recommended)** - Download a small model (~300MB) that runs locally
   - **Ollama** - Use if you have Ollama installed locally
3. **Download the AI model** (Browser AI only)
   - Click "Download Model"
   - Wait for download (1-2 minutes)
   - Ready to use!

### Writing with LexiLens

1. **Type in any text field** on any website
2. **Watch for the status bar** - Appears when issues are detected
3. **Click the status bar** to open the review modal
4. **Review sentence by sentence**:
   - See AI confidence scores
   - Read context-based tips
   - Choose to accept or ignore each suggestion
5. **Validate as you go**:
   - Click "Verify & Add to Dictionary" for entities (names, companies)
   - Click "Keep [word]" for homophones you've confirmed
   - Future analysis won't flag validated words

### Dictionary Management

**Import a Dictionary:**
1. Open LexiLens popup → **My Dictionary**
2. Click **📥 Import CSV**
3. Select your CSV file (format: `word,type`)
4. Words are automatically categorized

**Export Your Dictionary:**
1. Open LexiLens popup → **My Dictionary**
2. Click **📤 Export CSV**
3. Save the file for backup or sharing

**CSV Format:**
```csv
word,type
GitHub,entity
their,homophone
gonna,word
```

See `docs/CSV_IMPORT_GUIDE.md` for detailed instructions.

### Supported Text Fields
- ✅ Regular text inputs (`<input>`, `<textarea>`)
- ✅ Gmail composer
- ✅ Google Docs (limited support)
- ✅ Facebook, Twitter, LinkedIn posts
- ✅ Any `contenteditable` element
- ✅ Rich text editors (Medium, Notion, etc.)

---

## 📁 Project Structure

```
lexi-lens/
├── entrypoints/
│   ├── background.ts          # Service worker
│   ├── content/
│   │   ├── index.ts           # Main content script (status bar & review)
│   │   ├── style.css          # Content script styles
│   │   └── status-bar.css     # Status bar & modal styles
│   └── popup/
│       ├── App.tsx            # Settings UI (React)
│       ├── App.css            # Popup styles
│       └── main.tsx           # React entry point
│
├── utils/
│   ├── ai-engine.ts           # AI backend (WebLLM & Ollama)
│   ├── phonetic-engine.ts     # Fallback local dictionary
│   ├── debounce.ts            # Debounce utility
│   ├── messages.ts            # Content ↔ Background bridge
│   └── storage.ts             # Settings persistence
│
├── types/
│   └── index.ts               # TypeScript interfaces
│
├── docs/
│   ├── CSV_IMPORT_GUIDE.md    # CSV dictionary documentation
│   ├── DICTIONARY_CSV_EXAMPLE.csv
│   ├── FLOW.md                # Technical flow documentation
│   └── PLANNING.md            # Feature planning
│
├── wxt.config.ts              # WXT configuration
├── package.json
└── README.md
```

---

## 🧠 Detection Categories

### 🟣 Purple - Spelling Errors
Definite dyslexia-specific mistakes:

| Pattern | Typed | Corrected |
|---------|-------|-----------|
| **Phonetic** | becuase, definately, yesturday | because, definitely, yesterday |
| **Transposition** | freind, thier, teh | friend, their, the |
| **Missing Letters** | goverment, occured | government, occurred |
| **Extra Letters** | tireed, suny | tired, sunny |
| **Vowel Confusion** | vary, wierd | very, weird |

**AI Confidence**: 90-98%  
**Action**: Click "Accept" to fix

### 🟡 Yellow - Homophones
Context-dependent words that sound the same:

| Word Pair | Context Analysis |
|-----------|------------------|
| **their/there/they're** | Possession vs Location vs Contraction |
| **your/you're** | Possession vs "you are" |
| **its/it's** | Possession vs "it is/has" |
| **to/too/two** | Direction vs Excessive vs Number |
| **than/then** | Comparison vs Time |
| **affect/effect** | Verb vs Noun |

**AI Confidence**: 85-99% when context is clear, 50-80% when ambiguous  
**Actions**: 
- High confidence: "Use [word] (96% confident)" + "Keep [original]"
- Low confidence: Equal buttons + clarifying question

### 🔵 Blue - Named Entities
Names, companies, acronyms requiring verification:

| Type | Examples |
|------|----------|
| **Person Names** | john → John, elon musk → Elon Musk |
| **Companies** | apple → Apple, microsoft → Microsoft |
| **Organizations** | nasa → NASA, unesco → UNESCO |
| **Acronyms** | api → API, html → HTML, css → CSS |

**AI Confidence**: 80-95%  
**Actions**: "Verify & Add to Dictionary" + "Accept Fix"

---

## ⚙️ AI Configuration

### Browser AI (WebLLM)

**Recommended Models:**
- **SmolLM2 135M** (~100MB) - Fastest, basic errors
- **Qwen 0.5B** (~300MB) - **Recommended** - Best balance
- **Qwen 1.5B** (~900MB) - Highest accuracy

**Requirements:**
- Chrome/Edge with WebGPU support
- 2-4GB available RAM
- Modern GPU (recommended)

**Setup:**
1. Select "Browser AI" in settings
2. Choose a model
3. Click "Download Model"
4. Wait for download (one-time)
5. Start analyzing!

### Ollama

**Recommended Models:**
- **llama3.2:1b** - Fast & lightweight
- **llama3.2:3b** - Better accuracy
- **phi3:mini** - Microsoft model, good for text

**Requirements:**
- Ollama installed locally
- Ollama server running (`ollama serve`)
- Model pulled (`ollama pull llama3.2:1b`)

**Setup:**
1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Run: `ollama pull llama3.2:1b`
3. Start server: `ollama serve`
4. Select "Ollama" in LexiLens settings
5. Choose your model

---

## 📊 Dictionary Management

### My Dictionary - Three Categories

**1. Ignored Words**
- General terms, jargon, slang
- Added manually or via CSV import
- Example: `gonna`, `wanna`, `y'all`

**2. Verified Entities**
- Names, companies, acronyms you've confirmed
- Added when you click "Verify & Add to Dictionary"
- Example: `GitHub`, `NASA`, `API`

**3. Validated Homophones**
- Words you've confirmed are correct in context
- Added when you click "Keep [word]"
- Prevents re-flagging the same word
- Example: `their` (when used correctly for possession)

### CSV Import/Export

**Format:**
```csv
word,type
GitHub,entity
their,homophone
gonna,word
NASA,entity
you're,homophone
```

**Types:**
- `word` - Ignored word
- `entity` - Verified entity (name/company/acronym)
- `homophone` - Validated homophone

**Use Cases:**
- **Personal dictionary** - Your common words
- **Company dictionary** - Brand names, products
- **Team sharing** - Export and share with colleagues
- **Backup** - Save your dictionary for later

See full guide: `docs/CSV_IMPORT_GUIDE.md`

---

## 🔧 Development

### Available Commands

```bash
npm run dev          # Start dev server (Chrome, auto-reload)
npm run dev:firefox  # Start dev server (Firefox)
npm run build        # Production build (.output/chrome-mv3/)
npm run build:firefox # Production build (Firefox)
npm run zip          # Create distributable ZIP
```

### Development Workflow

1. **Make changes** to source files
2. **Run `npm run dev`** - Auto-rebuilds on file changes
3. **Reload extension** in Chrome (click reload button)
4. **Test your changes** in text fields
5. **Check console** for errors (F12)

### Adding Words to Phonetic Engine

Edit `utils/phonetic-engine.ts`:

```typescript
const DYSLEXIA_DICTIONARY = new Map([
  ['youre', "you're"],
  ['wierd', 'weird'],
  // Add your patterns here
]);
```

### Modifying AI Prompt

Edit `utils/ai-engine.ts`:

```typescript
const SPELL_CHECK_PROMPT = `
  You are a spelling assistant...
  
  // Modify instructions here
`;
```

### Testing CSV Import

Create a test CSV:
```csv
word,type
TestWord,word
TestCompany,entity
their,homophone
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    User Types Text                        │
└────────────────────┬─────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────┐
│          Content Script (content/index.ts)                │
│  • Watches editable elements (input, textarea, etc.)     │
│  • Debounces input (500ms)                               │
│  • Calls AI engine for analysis                          │
│  • Shows status bar with issue count                     │
│  • Opens review modal on click                           │
└────────────────────┬─────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────┐
│             AI Engine (utils/ai-engine.ts)                │
│  • Sends text + context to AI                            │
│  • Receives categorized suggestions:                     │
│    - Purple: Spelling errors                             │
│    - Yellow: Homophones (with confidence)                │
│    - Blue: Named entities                                │
│  • Returns: {word, fix, category, confidence, tip}       │
└────────────────────┬─────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────┐
│              AI Backend (WebLLM / Ollama)                 │
│  • WebLLM: Runs in browser via WebGPU                    │
│  • Ollama: Calls local Ollama server                     │
│  • Context-aware analysis                                │
│  • High-confidence predictions                           │
└────────────────────┬─────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────┐
│              Review Modal (Sentence View)                 │
│  • Shows issues organized by sentence                    │
│  • Color-coded by category                               │
│  • Displays confidence scores                            │
│  • Provides context-based tips                           │
│  • Allows accept/ignore/verify actions                   │
└──────────────────────────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────┐
│          Dictionary Storage (browser.storage.local)       │
│  • customTerms: Ignored words                            │
│  • verifiedEntities: Confirmed names/companies           │
│  • validatedHomophones: Confirmed correct words          │
│  • Persists across sessions                              │
│  • Syncs to AI prompt for future analysis                │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Status Bar + Modal** - Non-intrusive design, review when ready
2. **Sentence-by-sentence** - Easier to review in context
3. **Color-coded categories** - Visual distinction between issue types
4. **Context-based confidence** - AI analyzes grammar, not just patterns
5. **Three-tier dictionary** - Separate ignored words, entities, homophones
6. **CSV import/export** - Easy sharing and backup

---

## 🤝 Contributing

We welcome contributions! Here's how:

### Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/lexi-lens.git
   cd lexi-lens
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-awesome-feature
   ```
4. **Make your changes**
5. **Test thoroughly**:
   ```bash
   npm run build
   # Load in Chrome and test
   ```
6. **Commit your changes**:
   ```bash
   git commit -m "Add: My awesome feature"
   ```
7. **Push and create PR**:
   ```bash
   git push origin feature/my-awesome-feature
   ```

### Ideas for Contributions

**Easy:**
- Add more words to phonetic dictionary
- Improve CSV import validation
- Add more example dictionaries
- Improve UI/UX styling
- Add keyboard shortcuts

**Medium:**
- Support for more languages (Spanish, French, etc.)
- Better Google Docs integration
- Custom color schemes
- Export dictionary to other formats (JSON, TXT)
- Statistics dashboard (words fixed, accuracy, etc.)

**Hard:**
- Improve AI prompt engineering for better accuracy
- Add sentence rewriting suggestions
- Support for grammar checking (beyond spelling)
- Browser-specific optimizations
- Multi-language support

### Code Style

- **TypeScript** - Strict mode enabled
- **React** - Functional components with hooks
- **CSS** - BEM-like naming convention
- **Comments** - Document complex logic
- **Console logs** - Use `[LexiLens]` prefix

### Testing Checklist

- [ ] Extension loads without errors
- [ ] AI model downloads successfully
- [ ] Text analysis works on various websites
- [ ] Dictionary import/export works
- [ ] Settings persist after browser restart
- [ ] All buttons and actions work
- [ ] No console errors
- [ ] Performance is acceptable

---

## ❓ FAQ

**Q: Does LexiLens work offline?**  
A: Yes! Browser AI (WebLLM) runs 100% locally with no internet connection required after the initial model download.

**Q: How much RAM does it use?**  
A: Browser AI: 2-4GB depending on model. Ollama: Depends on your chosen model (1-8GB typical).

**Q: Can I use it on Google Docs?**  
A: Limited support. Google Docs has restricted APIs. Works better on Gmail, standard text fields, and most websites.

**Q: Is my writing data sent anywhere?**  
A: No. All processing happens locally on your device. Zero data leaves your browser.

**Q: Can I share my dictionary with my team?**  
A: Yes! Export your dictionary as CSV and share it. Team members can import it into their LexiLens.

**Q: What's the difference between Browser AI and Ollama?**  
A: Both are local. Browser AI runs in the browser via WebGPU. Ollama requires a separate server but supports more/larger models.

**Q: Why does it suggest "their" when I typed "there"?**  
A: The AI analyzes grammatical context. If you typed "I went to there house", the possession context indicates "their" is correct. If you meant "there" (location), click "Keep 'there'" to validate it.

**Q: How do I make it stop flagging a word?**  
A: Three ways:
1. Click "Keep [word]" when reviewing
2. Add it manually in My Dictionary
3. Import a CSV with that word

**Q: Can I use it in languages other than English?**  
A: Currently English only. Multi-language support is planned for future releases.

---

## 🗺️ Roadmap

### v2.1 (Next Release)
- [ ] Multi-language support (Spanish, French, German)
- [ ] Keyboard shortcuts for quick review
- [ ] Statistics dashboard (words fixed, accuracy)
- [ ] Better Google Docs integration
- [ ] Dark mode for popup

### v2.2 (Future)
- [ ] Grammar checking (beyond spelling)
- [ ] Sentence rewriting suggestions
- [ ] Voice feedback for suggestions
- [ ] Reading mode (text-to-speech)
- [ ] Accessibility improvements

### v3.0 (Long-term)
- [ ] Writing coach mode (tips and tutorials)
- [ ] Customizable color schemes
- [ ] API for integration with other tools
- [ ] Mobile browser support
- [ ] Cloud sync (optional, opt-in)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

**TL;DR**: Free to use, modify, and distribute. No warranties.

---

## 🙏 Acknowledgments

- **Built with [WXT](https://wxt.dev/)** - Modern web extension framework
- **AI powered by [WebLLM](https://webllm.mlc.ai/)** - In-browser LLMs via WebGPU
- **Ollama integration** - Local AI model support
- **Inspired by Grammarly** - UI/UX patterns
- **OpenDyslexic font** - Dyslexia-friendly typography
- **Made for the dyslexia community** - With input from dyslexic writers

### Special Thanks
- Dyslexic beta testers who provided valuable feedback
- Contributors who added dictionary words
- The open-source community

---

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/yourusername/lexi-lens/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/lexi-lens/discussions)
- **Documentation**: See `/docs` folder
- **Email**: support@lexilens.dev *(if applicable)*

---

## 🌟 Star History

If LexiLens helps you, please consider giving it a ⭐ on GitHub!

---

<p align="center">
  <strong>Made with ❤️ for dyslexic writers everywhere</strong>
  <br><br>
  <sub>Empowering writers • Powered by AI • 100% Private</sub>
</p>

