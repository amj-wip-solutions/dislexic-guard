/**
 * LexiLens Phonetic Correction Engine
 * Provides phonetically-aware spelling suggestions for dyslexia support
 *
 * Color-coded categories:
 * - purple: High-stakes definite errors
 * - yellow: Homophones/ambiguous (need context)
 * - blue: Names, acronyms, technical terms
 * - orange: Common typos
 * - green: Optional suggestions
 */

import type { SpellingSuggestion, IssueCategory } from '../types';

// =============================================================================
// Dyslexia-Specific Corrections (Purple - High Stakes)
// =============================================================================

const DYSLEXIA_ERRORS: ReadonlyMap<string, { correction: string; tip: string }> = new Map([
  // Phonetic confusions - common dyslexia patterns
  ['yesturday', { correction: 'yesterday', tip: 'Sound it out: YES-ter-day' }],
  ['yesterdya', { correction: 'yesterday', tip: 'Sound it out: YES-ter-day' }],
  ['vary', { correction: 'very', tip: '"Very" has an "e" - think "vEry good"' }],
  ['suny', { correction: 'sunny', tip: 'Double "n" for sunny - suNNy' }],
  ['sunnny', { correction: 'sunny', tip: 'Only two "n"s - suNNy' }],
  ['desided', { correction: 'decided', tip: '"Decide" has a "c" - deCided' }],
  ['decidid', { correction: 'decided', tip: 'Ends in "-ed" not "-id"' }],
  ['tireed', { correction: 'tired', tip: 'Only one "e" at the end - tirEd' }],
  ['tierd', { correction: 'tired', tip: 'The "i" comes first - tIred' }],
  ['qwickly', { correction: 'quickly', tip: '"Quick" starts with "qu" not "qw"' }],
  ['quikly', { correction: 'quickly', tip: 'Don\'t forget the "c" - quiCKly' }],
  ['quickley', { correction: 'quickly', tip: 'Ends in "-ly" not "-ley"' }],
  ['brote', { correction: 'brought', tip: '"Brought" has "ough" - brOUGHt' }],
  ['brot', { correction: 'brought', tip: '"Brought" has "ough" - brOUGHt' }],
  ['brough', { correction: 'brought', tip: 'Don\'t forget the "t" - broughT' }],
  ['brid', { correction: 'bird', tip: 'Letters swapped! b-i-r-d' }],
  ['bidr', { correction: 'bird', tip: 'Letters swapped! b-i-r-d' }],
  ['sowng', { correction: 'song', tip: 'No "w" in song - just sONg' }],
  ['songe', { correction: 'song', tip: 'No "e" at the end - song' }],
  ['wright', { correction: 'write', tip: '"Write" has no "gh" - wrIte (Wright is a name!)' }],
  ['rite', { correction: 'write', tip: 'Don\'t forget the "w" - Write' }],
  ['wriet', { correction: 'write', tip: 'Letters swapped! w-r-i-t-e' }],
  ['corectly', { correction: 'correctly', tip: 'Double "r" - coRRectly' }],
  ['correctley', { correction: 'correctly', tip: 'Ends in "-ly" not "-ley"' }],
  ['dancng', { correction: 'dancing', tip: 'Don\'t forget the "i" - dancIng' }],
  ['dansing', { correction: 'dancing', tip: '"Dance" has a "c" - danCing' }],
  ['triky', { correction: 'tricky', tip: '"Trick" has "ck" - triCKy' }],
  ['trikcy', { correction: 'tricky', tip: 'The "c" and "k" together - triCKy' }],
  ['stoeries', { correction: 'stories', tip: 'No "e" - stOries (story → stories)' }],
  ['storys', { correction: 'stories', tip: '"y" changes to "ies" - storIES' }],
  ['stoires', { correction: 'stories', tip: 'Letters swapped! s-t-o-r-i-e-s' }],

  // Original entries
  ['frend', { correction: 'friend', tip: '"i" before "e" - think "I am your frIEnd"' }],
  ['freind', { correction: 'friend', tip: '"i" before "e" except after "c"' }],
  ['firend', { correction: 'friend', tip: 'Letters swapped! f-r-i-e-n-d' }],
  ['wich', { correction: 'which', tip: 'Starts with "wh" - "WHich one?"' }],
  ['whitch', { correction: 'which', tip: 'No "t" - just whICH' }],
  ['thier', { correction: 'their', tip: '"i" before "e" - "thEIr" belongs to thEm' }],
  ['becuase', { correction: 'because', tip: 'Sound it out: be-CAUSE' }],
  ['beacuse', { correction: 'because', tip: 'Sound it out: be-CAUSE' }],
  ['becasue', { correction: 'because', tip: 'Sound it out: be-CAUSE' }],
  ['becaus', { correction: 'because', tip: 'Don\'t forget the "e" - becausE' }],
  ['wierd', { correction: 'weird', tip: '"Weird" is weird - "e" before "i"!' }],
  ['recieve', { correction: 'receive', tip: '"i" before "e" EXCEPT after "c" - reCEIve' }],
  ['beleive', { correction: 'believe', tip: 'Don\'t beLIEve a LIE' }],
  ['belive', { correction: 'believe', tip: 'Don\'t beLIEve a LIE' }],
  ['beleave', { correction: 'believe', tip: 'Don\'t beLIEve a LIE' }],
  ['definately', { correction: 'definitely', tip: 'There\'s "finite" in deFINITEly' }],
  ['definatly', { correction: 'definitely', tip: 'There\'s "finite" in deFINITEly' }],
  ['deffinately', { correction: 'definitely', tip: 'One "f", and "finite" inside - deFINITEly' }],
  ['seperate', { correction: 'separate', tip: 'There\'s "A RAT" in sepARAte' }],
  ['seperete', { correction: 'separate', tip: 'There\'s "A RAT" in sepARAte' }],
  ['occured', { correction: 'occurred', tip: 'Double "c", double "r" - oCCuRRed' }],
  ['ocurred', { correction: 'occurred', tip: 'Double "c", double "r" - oCCuRRed' }],
  ['untill', { correction: 'until', tip: 'Only ONE "l" - untiL' }],
  ['tommorrow', { correction: 'tomorrow', tip: 'One "m", two "r"s - toMoRRow' }],
  ['tommorow', { correction: 'tomorrow', tip: 'One "m", two "r"s - toMoRRow' }],
  ['tomorow', { correction: 'tomorrow', tip: 'Two "r"s - tomoRRow' }],
  ['accomodate', { correction: 'accommodate', tip: 'Two "c"s, two "m"s - aCCoMModate' }],
  ['acommodate', { correction: 'accommodate', tip: 'Two "c"s, two "m"s - aCCoMModate' }],
  ['recomend', { correction: 'recommend', tip: 'One "c", two "m"s - reCOMMend' }],
  ['reccommend', { correction: 'recommend', tip: 'One "c", two "m"s - reCOMMend' }],
  ['neccessary', { correction: 'necessary', tip: 'One "c", two "s"s - neCeSSary' }],
  ['necesary', { correction: 'necessary', tip: 'One "c", two "s"s - neCeSSary' }],
  ['neccesary', { correction: 'necessary', tip: 'One "c", two "s"s - neCeSSary' }],
  ['goverment', { correction: 'government', tip: 'Don\'t forget the "n" - goverNment' }],
  ['govenment', { correction: 'government', tip: 'It\'s "govern" + "ment" - govERNment' }],
  ['enviroment', { correction: 'environment', tip: 'Don\'t forget the "n" - enviroNment' }],
  ['enviornment', { correction: 'environment', tip: 'Watch the order - envi-RON-ment' }],
  ['occurence', { correction: 'occurrence', tip: 'Double "c", double "r" - oCCuRRence' }],
  ['begining', { correction: 'beginning', tip: 'Double "n" - begiNNing' }],
  ['beggining', { correction: 'beginning', tip: 'One "g", two "n"s - beGiNNing' }],
  ['arguement', { correction: 'argument', tip: 'No "e" - just argUment' }],
  ['independant', { correction: 'independent', tip: 'Ends in "-ent" not "-ant"' }],
  ['calender', { correction: 'calendar', tip: 'Ends in "-ar" - calendAR' }],
  ['existance', { correction: 'existence', tip: 'Ends in "-ence" - existENCE' }],
  ['experiance', { correction: 'experience', tip: 'Ends in "-ence" - experiENCE' }],
  ['expierence', { correction: 'experience', tip: 'Watch the order: ex-PER-i-ence' }],
  ['noticable', { correction: 'noticeable', tip: 'Keep the "e" - noticeABLE' }],
  ['posession', { correction: 'possession', tip: 'Double "s" twice - poSSeSSion' }],
  ['priviledge', { correction: 'privilege', tip: 'No "d" - privilEGE' }],
  ['rythm', { correction: 'rhythm', tip: 'No vowels! R-H-Y-T-H-M' }],
  ['rhythym', { correction: 'rhythm', tip: 'Only one "y" - rhYthm' }],
  ['suprise', { correction: 'surprise', tip: 'First "r" is easy to miss - suRprise' }],
  ['surprize', { correction: 'surprise', tip: 'Ends in "-ise" not "-ize"' }],

  // More common dyslexia patterns
  ['diffrent', { correction: 'different', tip: 'Don\'t forget the second "e" - diffErEnt' }],
  ['differant', { correction: 'different', tip: 'Ends in "-ent" - differENT' }],
  ['beautifull', { correction: 'beautiful', tip: 'Only one "l" at the end - beautifuL' }],
  ['bueatiful', { correction: 'beautiful', tip: 'Sound it out: beau-ti-ful' }],
  ['beutiful', { correction: 'beautiful', tip: 'Don\'t forget the "a" - beAUtiful' }],
  ['probly', { correction: 'probably', tip: 'Don\'t forget "ab" - probABly' }],
  ['probaly', { correction: 'probably', tip: 'Two "b"s - proBaBly' }],
  ['finaly', { correction: 'finally', tip: 'Double "l" - finaLLy' }],
  ['realy', { correction: 'really', tip: 'Double "l" - reaLLy' }],
  ['actualy', { correction: 'actually', tip: 'Double "l" - actuaLLy' }],
  ['basicly', { correction: 'basically', tip: 'It\'s "basic" + "ally" - basicALLy' }],
  ['usally', { correction: 'usually', tip: 'Don\'t forget the "u" - usUally' }],
  ['ususally', { correction: 'usually', tip: 'Only two "u"s - Usually' }],
]);

// =============================================================================
// Common Typos (Orange)
// =============================================================================

const COMMON_TYPOS: ReadonlyMap<string, string> = new Map([
  ['teh', 'the'],
  ['taht', 'that'],
  ['adn', 'and'],
  ['hte', 'the'],
  ['thnk', 'think'],
  ['waht', 'what'],
  ['whta', 'what'],
  ['yuo', 'you'],
  ['jsut', 'just'],
  ['liek', 'like'],
  ['aobut', 'about'],
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
  ['alot', 'a lot'],
]);

// =============================================================================
// Letter Reversals (Purple - Dyslexia specific)
// =============================================================================

const LETTER_REVERSALS: ReadonlyMap<string, { correction: string; tip: string }> = new Map([
  ['doy', { correction: 'boy', tip: 'b/d reversal - "b" has belly in front' }],
  ['dag', { correction: 'bag', tip: 'b/d reversal - "b" has belly in front' }],
  ['dack', { correction: 'back', tip: 'b/d reversal - "b" has belly in front' }],
  ['boor', { correction: 'door', tip: 'b/d reversal - "d" has belly behind' }],
  ['bate', { correction: 'date', tip: 'b/d reversal - "d" has belly behind' }],
  ['qark', { correction: 'park', tip: 'p/q reversal - "p" points right' }],
  ['qen', { correction: 'pen', tip: 'p/q reversal - "p" points right' }],
  ['nife', { correction: 'knife', tip: 'Silent "k" at the start' }],
  ['nock', { correction: 'knock', tip: 'Silent "k" at the start' }],
  ['rong', { correction: 'wrong', tip: 'Silent "w" at the start' }],
  ['rite', { correction: 'write', tip: 'Silent "w" at the start' }],
]);

// =============================================================================
// Homophones (Yellow - Need context)
// =============================================================================

const HOMOPHONES: ReadonlyMap<string, { alternatives: string[]; tip: string }> = new Map([
  ['their', { alternatives: ['there', "they're"], tip: '📦 their = belongs to them | 📍 there = location | 👥 they\'re = they are' }],
  ['there', { alternatives: ['their', "they're"], tip: '📍 there = location | 📦 their = belongs to them | 👥 they\'re = they are' }],
  ["they're", { alternatives: ['their', 'there'], tip: '👥 they\'re = they are | 📦 their = belongs to them | 📍 there = location' }],
  ['theyre', { alternatives: ['their', 'there', "they're"], tip: 'Did you mean "they\'re" (they are)?' }],
  ['your', { alternatives: ["you're"], tip: '📦 your = belongs to you | 👤 you\'re = you are' }],
  ["you're", { alternatives: ['your'], tip: '👤 you\'re = you are | 📦 your = belongs to you' }],
  ['its', { alternatives: ["it's"], tip: '📦 its = belongs to it | ⚡ it\'s = it is' }],
  ["it's", { alternatives: ['its'], tip: '⚡ it\'s = it is | 📦 its = belongs to it' }],
  ['to', { alternatives: ['too', 'two'], tip: '➡️ to = direction | ➕ too = also/excessive | 2️⃣ two = number 2' }],
  ['too', { alternatives: ['to', 'two'], tip: '➕ too = also/excessive | ➡️ to = direction | 2️⃣ two = number 2' }],
  ['two', { alternatives: ['to', 'too'], tip: '2️⃣ two = number 2 | ➡️ to = direction | ➕ too = also' }],
  ['affect', { alternatives: ['effect'], tip: '🎬 Affect = Action (verb) | 📊 Effect = End result (noun)' }],
  ['effect', { alternatives: ['affect'], tip: '📊 Effect = End result (noun) | 🎬 Affect = Action (verb)' }],
  ['then', { alternatives: ['than'], tip: '⏰ then = time/sequence | ⚖️ than = comparison' }],
  ['than', { alternatives: ['then'], tip: '⚖️ than = comparison | ⏰ then = time/sequence' }],
  ['accept', { alternatives: ['except'], tip: '✅ accept = receive/agree | ❌ except = exclude' }],
  ['except', { alternatives: ['accept'], tip: '❌ except = exclude | ✅ accept = receive/agree' }],
  ['lose', { alternatives: ['loose'], tip: '❌ lose = misplace | 🔓 loose = not tight' }],
  ['loose', { alternatives: ['lose'], tip: '🔓 loose = not tight | ❌ lose = misplace' }],
  ['weather', { alternatives: ['whether'], tip: '🌤️ weather = climate | 🤔 whether = if' }],
  ['whether', { alternatives: ['weather'], tip: '🤔 whether = if | 🌤️ weather = climate' }],
  ['right', { alternatives: ['write', 'rite'], tip: '✅ right = correct | ✍️ write = text | 🙏 rite = ceremony' }],
  ['write', { alternatives: ['right', 'rite'], tip: '✍️ write = text | ✅ right = correct | 🙏 rite = ceremony' }],
  ['know', { alternatives: ['no'], tip: '🧠 know = understand | 🚫 no = negative' }],
  ['no', { alternatives: ['know'], tip: '🚫 no = negative | 🧠 know = understand' }],
  ['hear', { alternatives: ['here'], tip: '👂 hear = listen | 📍 here = this place' }],
  ['here', { alternatives: ['hear'], tip: '📍 here = this place | 👂 hear = listen' }],
  ['piece', { alternatives: ['peace'], tip: '🧩 piece = part | ☮️ peace = calm' }],
  ['peace', { alternatives: ['piece'], tip: '☮️ peace = calm | 🧩 piece = part' }],
]);

// =============================================================================
// Core Analysis Functions
// =============================================================================

/**
 * Analyze text and return spelling suggestions with categories
 */
export function analyzeText(text: string): SpellingSuggestion[] {
  const suggestions: SpellingSuggestion[] = [];
  const words = extractWords(text);

  console.log('[LexiLens] Analyzing', words.length, 'words');

  for (const { word, start, end } of words) {
    const lowerWord = word.toLowerCase();

    // 1. Check dyslexia-specific errors (Purple)
    const dyslexiaError = DYSLEXIA_ERRORS.get(lowerWord);
    if (dyslexiaError) {
      suggestions.push({
        original: word,
        suggestions: [preserveCase(word, dyslexiaError.correction)],
        confidence: 0.95,
        source: 'local',
        position: { start, end },
        category: 'purple',
        tip: dyslexiaError.tip,
      });
      continue;
    }

    // 2. Check letter reversals (Purple)
    const reversal = LETTER_REVERSALS.get(lowerWord);
    if (reversal) {
      suggestions.push({
        original: word,
        suggestions: [preserveCase(word, reversal.correction)],
        confidence: 0.9,
        source: 'local',
        position: { start, end },
        category: 'purple',
        tip: reversal.tip,
      });
      continue;
    }

    // 3. Check common typos (Orange)
    const typoCorrection = COMMON_TYPOS.get(lowerWord);
    if (typoCorrection) {
      suggestions.push({
        original: word,
        suggestions: [preserveCase(word, typoCorrection)],
        confidence: 0.9,
        source: 'local',
        position: { start, end },
        category: 'orange',
        tip: 'Common typo - quick fix!',
      });
      continue;
    }

    // 4. Check homophones (Yellow - need context)
    const homophone = HOMOPHONES.get(lowerWord);
    if (homophone) {
      suggestions.push({
        original: word,
        suggestions: homophone.alternatives.map((h) => preserveCase(word, h)),
        confidence: 0.5,
        source: 'local',
        position: { start, end },
        category: 'yellow',
        tip: homophone.tip,
      });
    }
  }

  console.log('[LexiLens] Found', suggestions.length, 'suggestions');
  return suggestions;
}

/**
 * Quick check if a word needs correction
 */
export function needsCorrection(word: string): boolean {
  const lowerWord = word.toLowerCase();
  return (
    DYSLEXIA_ERRORS.has(lowerWord) ||
    LETTER_REVERSALS.has(lowerWord) ||
    COMMON_TYPOS.has(lowerWord)
  );
}

/**
 * Get instant correction for a single word (if available)
 */
export function getInstantCorrection(word: string): string | null {
  const lowerWord = word.toLowerCase();

  const dyslexiaError = DYSLEXIA_ERRORS.get(lowerWord);
  if (dyslexiaError) return preserveCase(word, dyslexiaError.correction);

  const reversal = LETTER_REVERSALS.get(lowerWord);
  if (reversal) return preserveCase(word, reversal.correction);

  const typo = COMMON_TYPOS.get(lowerWord);
  if (typo) return preserveCase(word, typo);

  return null;
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
 * Extract words with their EXACT positions from text
 * Improved accuracy for highlighting
 */
function extractWords(text: string): WordMatch[] {
  const words: WordMatch[] = [];

  // Match words including contractions
  const regex = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const word = match[0];

    // Skip very short words unless they're known issues
    if (word.length < 2) continue;

    // Verify position is correct
    const actualWord = text.substring(match.index, match.index + word.length);
    if (actualWord !== word) {
      console.warn('[LexiLens] Position mismatch:', word, 'vs', actualWord);
      continue;
    }

    words.push({
      word: word,
      start: match.index,
      end: match.index + word.length,
    });
  }

  return words;
}

/**
 * Preserve the case pattern of the original word in the correction
 */
function preserveCase(original: string, correction: string): string {
  if (original === original.toUpperCase()) {
    return correction.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return correction.charAt(0).toUpperCase() + correction.slice(1).toLowerCase();
  }
  return correction.toLowerCase();
}

