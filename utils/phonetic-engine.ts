/**
 * LexiLens Phonetic Correction Engine
 * Provides phonetically-aware spelling suggestions for dyslexia support
 */

import type { SpellingSuggestion } from '../types';

// =============================================================================
// Common Dyslexia-Specific Word Swaps
// Maps misspellings to correct spellings
// =============================================================================

const DYSLEXIA_DICTIONARY: ReadonlyMap<string, string> = new Map([
  // Phonetic confusions
  ['frend', 'friend'],
  ['freind', 'friend'],
  ['wich', 'which'],
  ['thier', 'their'],
  ['teh', 'the'],
  ['taht', 'that'],
  ['adn', 'and'],
  ['becuase', 'because'],
  ['beacuse', 'because'],
  ['becasue', 'because'],
  ['wierd', 'weird'],
  ['recieve', 'receive'],
  ['beleive', 'believe'],
  ['belive', 'believe'],
  ['definately', 'definitely'],
  ['definatly', 'definitely'],
  ['seperate', 'separate'],
  ['occured', 'occurred'],
  ['untill', 'until'],
  ['tommorrow', 'tomorrow'],
  ['tommorow', 'tomorrow'],
  ['accomodate', 'accommodate'],
  ['recomend', 'recommend'],
  ['neccessary', 'necessary'],
  ['necesary', 'necessary'],
  ['goverment', 'government'],
  ['enviroment', 'environment'],
  ['occurence', 'occurrence'],
  ['refered', 'referred'],
  ['begining', 'beginning'],
  ['arguement', 'argument'],
  ['independant', 'independent'],
  ['calender', 'calendar'],
  ['existance', 'existence'],
  ['experiance', 'experience'],
  ['noticable', 'noticeable'],
  ['publically', 'publicly'],
  ['posession', 'possession'],
  ['persistant', 'persistent'],
  ['priviledge', 'privilege'],
  ['pronounciation', 'pronunciation'],
  ['questionaire', 'questionnaire'],
  ['rythm', 'rhythm'],
  ['sieze', 'seize'],
  ['suprise', 'surprise'],
  ['temperture', 'temperature'],
  ['vaccuum', 'vacuum'],

  // Letter reversals (b/d, p/q)
  ['doy', 'boy'],
  ['dag', 'bag'],
  ['dack', 'back'],
  ['durger', 'burger'],
  ['boor', 'door'],
  ['bate', 'date'],
  ['binner', 'dinner'],
  ['qark', 'park'],
  ['qen', 'pen'],

  // Common typing errors
  ['hte', 'the'],
  ['thnk', 'think'],
  ['dont', "don't"],
  ['didnt', "didn't"],
  ['cant', "can't"],
  ['wont', "won't"],
  ['wouldnt', "wouldn't"],
  ['couldnt', "couldn't"],
  ['shouldnt', "shouldn't"],
  ['youre', "you're"],
  ['theyre', "they're"],
  ['weve', "we've"],
  ['ive', "I've"],
  ['im', "I'm"],
  ['its', "it's"], // Note: context-dependent

  // Silent letter confusions
  ['nife', 'knife'],
  ['nock', 'knock'],
  ['nowledge', 'knowledge'],
  ['rong', 'wrong'],
  ['rite', 'write'],
  ['riting', 'writing'],
  ['anser', 'answer'],
  ['lissen', 'listen'],
  ['offen', 'often'],

  // Vowel confusions
  ['wether', 'whether'],
  ['wheather', 'weather'],
  ['alot', 'a lot'],
  ['alright', 'all right'],
  ['everytime', 'every time'],
  ['eachother', 'each other'],
  ['incase', 'in case'],
]);

// =============================================================================
// Homophone Groups
// Words that sound the same but have different meanings
// =============================================================================

const HOMOPHONES: ReadonlyMap<string, readonly string[]> = new Map([
  ['their', ['there', "they're"]],
  ['there', ['their', "they're"]],
  ["they're", ['their', 'there']],
  ['your', ["you're"]],
  ["you're", ['your']],
  ['its', ["it's"]],
  ["it's", ['its']],
  ['to', ['too', 'two']],
  ['too', ['to', 'two']],
  ['two', ['to', 'too']],
  ['weather', ['whether']],
  ['whether', ['weather']],
  ['right', ['write', 'rite']],
  ['write', ['right', 'rite']],
  ['know', ['no']],
  ['no', ['know']],
  ['new', ['knew']],
  ['knew', ['new']],
  ['hear', ['here']],
  ['here', ['hear']],
  ['bye', ['by', 'buy']],
  ['by', ['bye', 'buy']],
  ['buy', ['bye', 'by']],
  ['piece', ['peace']],
  ['peace', ['piece']],
  ['principal', ['principle']],
  ['principle', ['principal']],
  ['affect', ['effect']],
  ['effect', ['affect']],
  ['accept', ['except']],
  ['except', ['accept']],
  ['lose', ['loose']],
  ['loose', ['lose']],
  ['then', ['than']],
  ['than', ['then']],
]);

// =============================================================================
// Core Analysis Functions
// =============================================================================

/**
 * Analyze text and return spelling suggestions
 * This is the main entry point for the phonetic engine
 */
export function analyzeText(text: string): SpellingSuggestion[] {
  const suggestions: SpellingSuggestion[] = [];
  const words = extractWords(text);

  for (const { word, start, end } of words) {
    const lowerWord = word.toLowerCase();

    // Check dyslexia dictionary first (instant fixes)
    const dictCorrection = DYSLEXIA_DICTIONARY.get(lowerWord);
    if (dictCorrection) {
      suggestions.push({
        original: word,
        suggestions: [preserveCase(word, dictCorrection)],
        confidence: 0.95,
        source: 'local',
        position: { start, end },
      });
      continue;
    }

    // Check for potential homophone issues
    const homophones = HOMOPHONES.get(lowerWord);
    if (homophones) {
      suggestions.push({
        original: word,
        suggestions: homophones.map((h) => preserveCase(word, h)),
        confidence: 0.5, // Lower confidence - context needed
        source: 'local',
        position: { start, end },
      });
    }
  }

  return suggestions;
}

/**
 * Quick check if a word needs correction
 * Useful for performance when you don't need full suggestions
 */
export function needsCorrection(word: string): boolean {
  const lowerWord = word.toLowerCase();
  return DYSLEXIA_DICTIONARY.has(lowerWord);
}

/**
 * Get instant correction for a single word (if available)
 */
export function getInstantCorrection(word: string): string | null {
  const lowerWord = word.toLowerCase();
  const correction = DYSLEXIA_DICTIONARY.get(lowerWord);
  return correction ? preserveCase(word, correction) : null;
}

// =============================================================================
// Helper Functions
// =============================================================================

interface WordMatch {
  word: string;
  start: number;
  end: number;
}

/**
 * Extract words with their positions from text
 */
function extractWords(text: string): WordMatch[] {
  const words: WordMatch[] = [];
  const regex = /\b[a-zA-Z']+\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return words;
}

/**
 * Preserve the case pattern of the original word in the correction
 */
function preserveCase(original: string, correction: string): string {
  if (original === original.toUpperCase()) {
    // ALL CAPS
    return correction.toUpperCase();
  }

  if (original[0] === original[0].toUpperCase()) {
    // Title Case
    return correction.charAt(0).toUpperCase() + correction.slice(1);
  }

  // lowercase
  return correction.toLowerCase();
}

/**
 * Calculate Levenshtein distance between two strings
 * Useful for finding similar words when no dictionary match
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if two words are phonetically similar
 * Uses a simplified Soundex-like algorithm
 */
export function arePhoneticallySimilar(word1: string, word2: string): boolean {
  return getPhoneticCode(word1) === getPhoneticCode(word2);
}

/**
 * Generate a simplified phonetic code for a word
 * Based on Soundex but adapted for dyslexia patterns
 */
function getPhoneticCode(word: string): string {
  const lower = word.toLowerCase();

  // Keep first letter
  let code = lower[0];

  // Phonetic groupings
  const groups: Record<string, string> = {
    'b': '1', 'f': '1', 'p': '1', 'v': '1',
    'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
    'd': '3', 't': '3',
    'l': '4',
    'm': '5', 'n': '5',
    'r': '6',
  };

  let prevCode = groups[code] || '0';

  for (let i = 1; i < lower.length && code.length < 4; i++) {
    const char = lower[i];
    const charCode = groups[char];

    if (charCode && charCode !== prevCode) {
      code += charCode;
      prevCode = charCode;
    } else if (!charCode) {
      prevCode = '0';
    }
  }

  return code.padEnd(4, '0');
}

