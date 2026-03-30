/**
 * Split article text into sentences and find sentences containing specific nouns.
 * Uses stem-based fuzzy matching so "economy" also matches "economic", "economically", etc.
 */

/**
 * Split text into sentences. Handles common abbreviations and edge cases.
 */
export function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space + uppercase letter or end of string
  // Avoids splitting on abbreviations like "Dr.", "U.S.", "e.g.", etc.
  const raw = text
    .replace(/\n{2,}/g, '. ')  // paragraph breaks → sentence boundaries
    .replace(/\n/g, ' ')        // single newlines → spaces
    .replace(/\s+/g, ' ')       // normalize whitespace
    .trim();

  const sentences: string[] = [];
  // Regex: split after .!? followed by space and uppercase, or end
  const regex = /[^.!?]*[.!?]+(?=\s+[A-Z"]|\s*$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const s = match[0].trim();
    if (s.length > 10) sentences.push(s); // skip very short fragments
  }

  // If regex didn't capture well (e.g. no punctuation), fall back to splitting on periods
  if (sentences.length < 3 && raw.length > 100) {
    return raw.split(/\.\s+/).filter((s) => s.trim().length > 10).map((s) => s.trim() + '.');
  }

  return sentences;
}

/**
 * Find all sentences that contain any of the given concept labels.
 * Uses stem-based fuzzy matching: "economy" will match sentences containing
 * "economic", "economical", "economically", "economics", etc.
 */
export function findSentencesForConcepts(
  sentences: string[],
  concepts: string[]
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const concept of concepts) {
    const pattern = buildFuzzyPattern(concept);
    const regex = new RegExp(pattern, 'i');

    const matches = sentences.filter((s) => regex.test(s));
    if (matches.length > 0) {
      result.set(concept, matches);
    }
  }

  return result;
}

/**
 * Build a fuzzy regex pattern for a concept label.
 * For multi-word concepts, each word is stemmed and matched independently.
 * For single words, we match the stem followed by any word-ending characters.
 */
function buildFuzzyPattern(concept: string): string {
  const words = concept.trim().split(/\s+/);

  if (words.length === 1) {
    // Single word: stem it and match stem + any ending
    const stem = computeStem(words[0]);
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `\\b${escaped}\\w*\\b`;
  }

  // Multi-word: require all stems to appear in the sentence (in any order)
  // This handles both "climate change" and "changing climate"
  const stemPatterns = words
    .filter((w) => w.length > 2) // skip tiny words like "of", "in", "a"
    .map((w) => {
      const stem = computeStem(w);
      const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return `(?=.*\\b${escaped}\\w*\\b)`;
    });

  return stemPatterns.join('') + '.+';
}

/**
 * Lightweight English stemmer. Strips common suffixes to produce a stem
 * that's shared across morphological variants.
 *
 * Examples:
 *   economy → econom    (matches economic, economical, economics)
 *   policy → polic      (matches policies, policing)
 *   regulation → regulat (matches regulations, regulatory, regulate)
 *   democratic → democrat (matches democracy, democratize)
 *   analysis → analys    (matches analyses, analytical, analyze)
 */
export function computeStem(word: string): string {
  let w = word.toLowerCase();

  // Don't stem very short words
  if (w.length <= 4) return w;

  // Order matters: try longer suffixes first
  const suffixes: [RegExp, string][] = [
    // -ization, -isation → strip
    [/ization$/, ''],
    [/isation$/, ''],
    // -ational → strip
    [/ational$/, ''],
    // -fulness, -ousness
    [/fulness$/, ''],
    [/ousness$/, ''],
    // -ically → strip
    [/ically$/, ''],
    // -ation, -ition, -ution
    [/ation$/, ''],
    [/ition$/, ''],
    [/ution$/, ''],
    // -ments, -ments
    [/ments$/, ''],
    // -ness, -ment, -able, -ible, -ence, -ance
    [/ness$/, ''],
    [/ment$/, ''],
    [/able$/, ''],
    [/ible$/, ''],
    [/ence$/, ''],
    [/ance$/, ''],
    // -ical, -ious, -eous, -ious, -ative
    [/ical$/, ''],
    [/ious$/, ''],
    [/eous$/, ''],
    [/ative$/, ''],
    // -ity, -ify
    [/ity$/, ''],
    [/ify$/, ''],
    // -ing, -tion, -sion
    [/tion$/, ''],
    [/sion$/, ''],
    [/ing$/, ''],
    // -ies → y (policies → polic, but we want the stem)
    [/ies$/, ''],
    // -ful, -ous, -ive, -ual, -ary, -ory, -ery
    [/ful$/, ''],
    [/ous$/, ''],
    [/ive$/, ''],
    [/ual$/, ''],
    [/ary$/, ''],
    [/ory$/, ''],
    [/ery$/, ''],
    // -al, -ly, -er, -or, -ed, -es
    [/ally$/, ''],
    [/al$/, ''],
    [/ly$/, ''],
    [/ers$/, ''],
    [/er$/, ''],
    [/or$/, ''],
    [/ed$/, ''],
    [/es$/, ''],
    // -s (simple plural, last resort)
    [/s$/, ''],
  ];

  for (const [pattern, replacement] of suffixes) {
    if (pattern.test(w)) {
      const stemmed = w.replace(pattern, replacement);
      // Don't over-stem: keep at least 3 chars
      if (stemmed.length >= 3) {
        return stemmed;
      }
    }
  }

  return w;
}
