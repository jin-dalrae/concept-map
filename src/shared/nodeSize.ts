/**
 * Shared node sizing logic used by both the layout engine (UI thread)
 * and the board renderer (plugin thread). Keeps dimensions in sync.
 */

const CHAR_WIDTH = 8;       // approximate width per character at font-size 13
const NODE_PADDING = 32;    // horizontal padding inside shape
const LINE_HEIGHT = 18;     // height per line of text
const VERTICAL_PADDING = 28; // top + bottom padding inside shape
const MIN_WIDTH = 140;
const MAX_WIDTH = 200;

/**
 * Wrap a label into lines that fit within MAX_WIDTH.
 * Returns the array of lines.
 */
export function wrapLabel(label: string): string[] {
  const maxChars = Math.floor((MAX_WIDTH - NODE_PADDING) / CHAR_WIDTH);
  const words = label.split(/\s+/);

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  return lines;
}

/**
 * Compute the width and height of a node shape given its label.
 */
export function computeNodeSize(label: string): { width: number; height: number } {
  const lines = wrapLabel(label);

  // Width: fit the longest line, clamped to [MIN_WIDTH, MAX_WIDTH]
  const longestLine = Math.max(...lines.map((l) => l.length));
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longestLine * CHAR_WIDTH + NODE_PADDING));

  // Height: scale with number of lines
  const height = VERTICAL_PADDING + lines.length * LINE_HEIGHT;

  return { width, height };
}
