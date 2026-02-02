import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'LexiLens - Dyslexia Writing Assistant',
    description: 'Grammarly-style writing assistant for dyslexia. Highlights and fixes phonetic spelling mistakes as you type.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab'],
    web_accessible_resources: [
      {
        resources: ['fonts/*.otf'],
        matches: ['<all_urls>'],
      },
    ],
  },
});

