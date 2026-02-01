# LexiLens 🔍✨

**A high-performance, dyslexia-focused reading and writing assistant browser extension.**

LexiLens helps users with dyslexia read and write more effectively across the web by providing visual aids and intelligent phonetic spelling corrections.

## ✨ Features

### 📏 Reading Ruler
A semi-transparent colored band that follows your mouse cursor vertically, helping you focus on one line of text at a time.

- Customizable color, opacity, and height
- Non-intrusive (never blocks page interactions)
- Works on all websites
- Toggle with `Alt+R`

### 📝 Phonetic Spelling Assistance
Intelligent spelling suggestions that understand how words *sound*, not just how they're spelled.

- **Local Dictionary**: Instant corrections for 100+ common dyslexia-specific misspellings
- **Homophone Awareness**: Helps distinguish between their/there/they're, your/you're, etc.
- **AI-Powered** (Optional): Enhanced suggestions via OpenAI API
- 1-second debounce to avoid interrupting your flow

### 🎨 Dyslexia-Friendly Design
- Warm, comfortable color palette
- Non-destructive overlays (never modifies webpage content)
- Accessible and screen-reader friendly

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Run in development mode (Chrome)
npm run dev

# Run in development mode (Firefox)
npm run dev:firefox
```

### Production Build

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox

# Create distributable ZIP
npm run zip
```

## 📦 Installation

### From Source (Development)
1. Run `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `.output/chrome-mv3` folder

### From Store (Coming Soon)
- Chrome Web Store
- Firefox Add-ons

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+R` | Toggle Reading Ruler |
| `Alt+L` | Toggle LexiLens completely |

## ⚙️ Configuration

Click the LexiLens icon in your browser toolbar to access settings:

### Reading Ruler
- **Enable/Disable**: Toggle the ruler on or off
- **Color**: Choose your preferred highlight color
- **Opacity**: Adjust transparency (10-80%)
- **Height**: Set the ruler band height (20-100px)

### Spelling Help
- **Enable/Disable**: Toggle spelling assistance
- **AI Provider**: Choose between local dictionary only, OpenAI, or disabled
- **API Key**: Required for OpenAI integration

## 🔒 Privacy

- All local dictionary lookups happen entirely on your device
- AI features are opt-in and require explicit configuration
- No data is collected or stored beyond your settings
- API keys are stored securely in browser storage

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LexiLens Extension                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Content Script (content/index.ts)                          │
│  ├── Reading Ruler (visual UI)                              │
│  ├── Text Capture (input monitoring)                        │
│  └── Suggestion Overlays                                    │
│                                                              │
│  Background Worker (background.ts)                          │
│  ├── AI Integration (OpenAI)                                │
│  ├── Heavy Processing                                       │
│  └── Settings Management                                    │
│                                                              │
│  Popup (popup/)                                             │
│  └── Settings UI                                            │
│                                                              │
│  Utilities (utils/)                                         │
│  ├── phonetic-engine.ts (local dictionary)                  │
│  ├── storage.ts (settings persistence)                      │
│  ├── messages.ts (content <-> background bridge)            │
│  └── debounce.ts (performance utility)                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

- **Framework**: [WXT](https://wxt.dev/) (Web Extension Toolbox)
- **Language**: TypeScript
- **UI**: React (popup only)
- **State**: `wxt/storage` for settings persistence
- **Supported Browsers**: Chrome (MV3), Firefox

## 📚 Documentation

See [docs/PLANNING.md](docs/PLANNING.md) for detailed architecture and implementation plans.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for the dyslexia community.
