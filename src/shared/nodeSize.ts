/**
 * Shared node sizing logic used by both the layout engine (UI thread)
 * and the board renderer (plugin thread). Keeps dimensions in sync.
 */

const CHAR_WIDTH = 7;       // approximate width per character at font-size 12
const NODE_PADDING = 24;    // horizontal padding inside shape
const NODE_HEIGHT = 36;     // fixed height for single-line text
const MIN_WIDTH = 60;

/**
 * Compute the width and height of a node shape given its label.
 * No wrapping - text stays on single line, shape adjusts to fit.
 */
export function computeNodeSize(label: string): { width: number; height: number } {
  const textWidth = label.length * CHAR_WIDTH;
  const width = Math.max(MIN_WIDTH, textWidth + NODE_PADDING);
  return { width, height: NODE_HEIGHT };
}
