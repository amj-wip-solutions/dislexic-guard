/**
 * LexiLens AI Integration
 * Supports two backends:
 * 1. Browser AI (WebLLM) - runs in browser via WebGPU
 * 2. Ollama - runs locally via Ollama server
 *
 * User chooses which one to use based on their setup.
 */

import type { SpellingSuggestion } from '../types';

// =============================================================================
// Types
// =============================================================================

export type AIBackend = 'browser' | 'ollama';

export interface BrowserModel {
  id: string;
  name: string;
  size: string;
  description: string;
}

export interface OllamaModel {
  id: string;
  name: string;
  description: string;
}

export interface AIConfig {
  backend: AIBackend;
  browserModelId: string;
  ollamaModelId: string;
  ollamaEndpoint: string;
  customTerms: string[];
  verifiedEntities: string[];
  validatedHomophones: string[];
  modelDownloaded: boolean;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  backend: 'browser',
  browserModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', // Default to recommended model
  ollamaModelId: 'llama3.2:1b',
  ollamaEndpoint: 'http://localhost:11434',
  customTerms: [],
  verifiedEntities: [],
  validatedHomophones: [],
  modelDownloaded: false,
};

// =============================================================================
// Available Models
// =============================================================================

export const BROWSER_MODELS: BrowserModel[] = [
  {
    id: 'SmolLM2-135M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 135M',
    size: '~100MB',
    description: 'Tiny & fast, good for basic errors',
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 0.5B',
    size: '~300MB',
    description: 'Small but smarter, recommended',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 1.5B',
    size: '~900MB',
    description: 'Best accuracy for browser',
  },
];

export const OLLAMA_MODELS: OllamaModel[] = [
  {
    id: 'llama3.2:1b',
    name: 'Llama 3.2 1B',
    description: 'Fast & lightweight',
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    description: 'Better accuracy',
  },
  {
    id: 'mistral',
    name: 'Mistral 7B',
    description: 'Best accuracy',
  },
  {
    id: 'phi3:mini',
    name: 'Phi-3 Mini',
    description: 'Microsoft, good for text',
  },
];

// =============================================================================
// Engine State
// =============================================================================

let browserEngine: any = null;
let currentBrowserModelId: string | null = null;

// =============================================================================
// WebGPU Support Check
// =============================================================================

export async function checkWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }
  try {
    const gpu = (navigator as any).gpu;
    const adapter = await gpu?.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

// =============================================================================
// Ollama Support Check
// =============================================================================

export async function checkOllamaAvailable(endpoint: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getOllamaModels(endpoint: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const response = await fetch(`${endpoint}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

// =============================================================================
// Browser AI (WebLLM)
// =============================================================================

export async function initBrowserAI(
  modelId: string,
  onProgress?: (progress: number, status: string) => void
): Promise<boolean> {
  console.log('[LexiLens AI] Initializing browser AI with model:', modelId);

  if (browserEngine && currentBrowserModelId === modelId) {
    console.log('[LexiLens AI] Model already loaded');
    return true;
  }

  try {
    onProgress?.(0, 'Loading WebLLM...');
    const webllm = await import('@mlc-ai/web-llm');

    onProgress?.(0.1, 'Downloading model...');
    const engine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report: { progress: number; text: string }) => {
        onProgress?.(report.progress, report.text);
      },
    });

    browserEngine = engine;
    currentBrowserModelId = modelId;
    console.log('[LexiLens AI] Browser AI ready!');
    return true;
  } catch (error) {
    console.error('[LexiLens AI] Failed to init browser AI:', error);
    return false;
  }
}

export function unloadBrowserAI(): void {
  browserEngine = null;
  currentBrowserModelId = null;
}

// =============================================================================
// Spell Check (works with both backends)
// =============================================================================

const SPELL_CHECK_PROMPT = `You are a spelling assistant specialized in helping dyslexic writers. Your job is to find EVERY spelling error AND identify named entities that need verification.

IMPORTANT: Analyze the FULL CONTEXT of each sentence to understand what the writer meant.

=== SECTION 1: SPELLING ERRORS ===
Find these dyslexia-specific errors:

1. PHONETIC ERRORS - words spelled how they SOUND:
   - yesturday → yesterday, becuase → because, definately → definitely
   - seperate → separate, probaly → probably, diffrent → different

2. LETTER TRANSPOSITIONS - letters in wrong order:
   - brid → bird, freind → friend, teh → the, thier → their

3. MISSING/EXTRA LETTERS:
   - goverment → government, occured → occurred
   - suny → sunny (missing double), tireed → tired (extra letter)
   - corectly → correctly, begining → beginning

4. VOWEL CONFUSIONS:
   - vary → very, stoeries → stories, wierd → weird

5. CONSONANT CONFUSIONS:
   - qwickly → quickly (qw vs qu), triky → tricky (missing c)
   - brote → brought, rite/wright → write

6. HOMOPHONES (sound same, different meaning) - MUST check sentence context:
   - their/there/they're, your/you're, its/it's
   - to/too/two, than/then, affect/effect, lose/loose

=== SECTION 2: ENTITY VERIFICATION (Named Entity Recognition) ===
Identify words that appear to be:

1. PERSON NAMES - First names, last names, full names
   - john → John, musk → Musk, elon musk → Elon Musk
   - michael → Michael (if context suggests it's a name)

2. COMPANY/ORGANIZATION NAMES - Companies, brands, organizations
   - apple → Apple, google → Google, microsoft → Microsoft
   - amazon → Amazon, tesla → Tesla, nike → Nike
   - unesco → UNESCO, nasa → NASA

3. ACRONYMS & ABBREVIATIONS - Technical terms, initialisms
   - api → API, html → HTML, css → CSS
   - ceo → CEO, usa → USA, uk → UK

For entities, provide the correct CASING and explain why it's flagged.

=== OUTPUT FORMAT ===
CATEGORIES:
🟣 "purple" = Definite spelling errors
🟡 "yellow" = Homophones where context is needed
🔵 "blue" = Named entities (Names, Companies, Acronyms) - ALWAYS include entity:true and entityType

FOR EACH ISSUE return:
- word: the EXACT word as it appears in the text
- fix: the correct spelling/casing
- cat: "purple", "yellow", or "blue"
- conf: confidence 0.0-1.0
- tip: A friendly 1-sentence explanation
- entity: (ONLY for blue) true if this is a named entity
- entityType: (ONLY for blue) "name", "company", or "acronym"
- q: (ONLY for yellow/homophones when conf < 0.8) A clarifying question

ENTITY EXAMPLES:
[
  {"word":"apple","fix":"Apple","cat":"blue","conf":0.85,"tip":"This looks like the company name Apple Inc.","entity":true,"entityType":"company"},
  {"word":"john","fix":"John","cat":"blue","conf":0.9,"tip":"This appears to be a person's name.","entity":true,"entityType":"name"},
  {"word":"api","fix":"API","cat":"blue","conf":0.95,"tip":"API is an acronym (Application Programming Interface).","entity":true,"entityType":"acronym"}
]

SPELLING EXAMPLES:
[
  {"word":"yesturday","fix":"yesterday","cat":"purple","conf":0.95,"tip":"Sound it out: YES-ter-day"},
  {"word":"your","fix":"you're","cat":"yellow","conf":0.95,"tip":"YOU'RE = you are (contraction)"}
]

CONFIDENCE FOR ENTITIES:
- 0.9-1.0: Obvious entity (context makes it clear it's a name/company)
- 0.8-0.9: Likely entity (capitalization or context suggests it)
- 0.6-0.8: Possible entity (could be a common word or a name)

BE THOROUGH - find ALL errors AND entities.
Return [] ONLY if the text has zero issues.
Output ONLY the JSON array, no other text.`;


export async function analyzeWithAI(
  text: string,
  config: AIConfig
): Promise<SpellingSuggestion[]> {
  if (!text || text.length < 3) return [];

  // Clean text - remove problematic characters
  const cleanText = text
    .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
    .replace(/"/g, "'")         // Replace double quotes with single
    .trim();

  console.log('[LexiLens AI] Analyzing text length:', cleanText.length);
  console.log('[LexiLens AI] Full text:', cleanText);

  // Combine custom terms and verified entities for the ignore list
  const allIgnoredTerms = [
    ...(config.customTerms || []),
    ...(config.verifiedEntities || []),
    ...(config.validatedHomophones || [])
  ];

  const customTermsNote = allIgnoredTerms.length > 0
    ? `\nIgnore these words (they are verified correct): ${allIgnoredTerms.join(', ')}`
    : '';

  const verifiedEntitiesNote = (config.verifiedEntities || []).length > 0
    ? `\nThese are verified entities (do NOT flag them): ${config.verifiedEntities.join(', ')}`
    : '';

  const validatedHomophonesNote = (config.validatedHomophones || []).length > 0
    ? `\nThese homophones have been validated by the user (do NOT flag them): ${config.validatedHomophones.join(', ')}`
    : '';

  const systemPrompt = SPELL_CHECK_PROMPT + customTermsNote + verifiedEntitiesNote + validatedHomophonesNote;
  const userPrompt = `Find ALL spelling errors and named entities in this text:\n\n${cleanText}`;

  let response: string;

  try {
    if (config.backend === 'ollama') {
      console.log('[LexiLens AI] Using Ollama...');
      response = await queryOllama(config.ollamaEndpoint, config.ollamaModelId, systemPrompt, userPrompt);
    } else {
      console.log('[LexiLens AI] Using Browser AI...');
      response = await queryBrowserAI(systemPrompt, userPrompt);
    }

    console.log('[LexiLens AI] Raw response:', response);
    return parseAIResponse(response, text); // Use original text for position matching
  } catch (error) {
    console.error('[LexiLens AI] Analysis failed:', error);
    return [];
  }
}

async function queryBrowserAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!browserEngine) {
    throw new Error('Browser AI not initialized');
  }

  const response = await browserEngine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 1500, // Increased for longer error lists
  });

  return response.choices[0]?.message?.content || '[]';
}

async function queryOllama(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `${systemPrompt}\n\nUser: ${userPrompt}`,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  return data.response || '[]';
}

function parseAIResponse(response: string, originalText: string): SpellingSuggestion[] {
  console.log('[LexiLens AI] Parsing response:', response.substring(0, 300));

  const jsonMatch = response.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) {
    console.log('[LexiLens AI] No JSON found');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const suggestions: SpellingSuggestion[] = [];
    const foundWords = new Set<string>();

    for (const item of parsed) {
      if (!item.word || !item.fix) continue;

      const wordLower = item.word.toLowerCase();
      if (foundWords.has(wordLower)) continue;

      // Find all occurrences
      const regex = new RegExp(`\\b${escapeRegExp(item.word)}\\b`, 'gi');
      let match;

      // Validate category - default to purple if invalid
      const validCategories = ['purple', 'yellow', 'blue', 'orange', 'green'];
      const category = validCategories.includes(item.cat) ? item.cat : 'purple';

      // Parse confidence - default based on category
      let confidence = 0.9;
      if (typeof item.conf === 'number') {
        confidence = Math.max(0, Math.min(1, item.conf));
      } else if (category === 'yellow') {
        confidence = 0.6; // Lower default for homophones
      }

      console.log(`[LexiLens AI] Processing: "${item.word}" → "${item.fix}" [${category}] conf:${confidence} tip: ${item.tip?.substring(0, 50)}`);

      while ((match = regex.exec(originalText)) !== null) {
        // Determine if this is an entity
        const isEntity = item.entity === true || category === 'blue';
        const entityType = item.entityType || (isEntity ? 'other' : undefined);

        suggestions.push({
          original: match[0],
          suggestions: [item.fix],
          confidence: confidence,
          source: 'ai',
          position: {
            start: match.index,
            end: match.index + match[0].length,
          },
          category: category,
          // Use AI-provided tip
          tip: item.tip || `Suggested: "${item.fix}"`,
          // Include clarifying question for homophones
          question: item.q || undefined,
          // Entity recognition fields
          isEntity: isEntity,
          entityType: isEntity ? entityType : undefined,
        });
      }

      foundWords.add(wordLower);
    }

    console.log('[LexiLens AI] Found', suggestions.length, 'issues');
    return suggestions;
  } catch (e) {
    console.error('[LexiLens AI] JSON parse error:', e);
    return [];
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Status Helpers
// =============================================================================

export function isAIReady(config: AIConfig): boolean {
  if (config.backend === 'ollama') {
    return true; // Ollama is stateless, always "ready" if available
  }
  return browserEngine !== null && currentBrowserModelId !== null;
}

export function getCurrentModelName(config: AIConfig): string {
  if (config.backend === 'ollama') {
    const model = OLLAMA_MODELS.find(m => m.id === config.ollamaModelId);
    return model?.name || config.ollamaModelId;
  }
  const model = BROWSER_MODELS.find(m => m.id === config.browserModelId);
  return model?.name || 'Unknown';
}

