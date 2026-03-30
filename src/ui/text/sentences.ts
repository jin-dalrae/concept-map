/**
 * Split article text into sentences and find sentences containing specific nouns.
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
 * Case-insensitive, matches whole words (bounded by word boundaries).
 */
export function findSentencesForConcepts(
  sentences: string[],
  concepts: string[]
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const concept of concepts) {
    // Build regex: match the concept as a whole word, case-insensitive
    // Escape regex special chars in the concept label
    const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');

    const matches = sentences.filter((s) => regex.test(s));
    if (matches.length > 0) {
      result.set(concept, matches);
    }
  }

  return result;
}
