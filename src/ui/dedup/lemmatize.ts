/**
 * Rule-based English lemmatization for grouping concept labels.
 * Conservative: better to miss a merge than incorrectly collapse distinct concepts.
 */
export function normalizeLemma(text: string): string {
  let word = text.toLowerCase().trim();

  // Multi-word: normalize each word
  if (word.includes(' ')) {
    return word
      .split(/\s+/)
      .map((w) => normalizeSingleWord(w))
      .join(' ');
  }

  return normalizeSingleWord(word);
}

function normalizeSingleWord(word: string): string {
  if (word.length <= 3) return word;

  const rules: [RegExp, string][] = [
    [/ies$/, 'y'],    // policies -> policy
    [/ves$/, 'f'],    // wolves -> wolf
    [/ses$/, 'se'],   // processes -> process (keep 'se')
    [/xes$/, 'x'],    // boxes -> box
    [/ches$/, 'ch'],  // watches -> watch
    [/shes$/, 'sh'],  // dishes -> dish
    [/s$/, ''],       // cats -> cat (simple plural)
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(word)) {
      return word.replace(pattern, replacement);
    }
  }

  return word;
}
