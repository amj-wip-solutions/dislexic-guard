import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'LexiLens - Dyslexia Writing Assistant',
    description: 'A dyslexia-focused reading and writing assistant with visual aids and phonetic spelling correction.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab'],
    commands: {
      'toggle-ruler': {
        suggested_key: {
          default: 'Alt+R',
          mac: 'Alt+R',
        },
        description: 'Toggle the Reading Ruler',
      },
      'toggle-extension': {
        suggested_key: {
          default: 'Alt+L',
          mac: 'Alt+L',
        },
        description: 'Toggle LexiLens completely',
      },
    },
  },
});
