import type { ConceptNodeType, DensityLevel } from './types';

// FigJam sticky note colors (RGB 0-1) mapped to concept node types
export const NODE_COLORS: Record<ConceptNodeType, { r: number; g: number; b: number }> = {
  concept: { r: 1.0, g: 0.87, b: 0.36 },   // Yellow
  actor:   { r: 0.76, g: 0.61, b: 0.92 },   // Purple
  process: { r: 0.51, g: 0.83, b: 0.98 },   // Blue
  outcome: { r: 0.56, g: 0.93, b: 0.56 },   // Green
};

// BFS expansion depth per density level
export const DENSITY_DEPTH: Record<DensityLevel, number> = {
  sparse: 3,
  standard: 5,
  dense: 10,
  exhaustive: 15,
};

// Legacy: still used by the old single-shot extraction prompt (kept for compatibility)
export const DENSITY_RANGES: Record<DensityLevel, { min: number; max: number }> = {
  sparse:     { min: 10, max: 15 },
  standard:   { min: 16, max: 25 },
  dense:      { min: 25, max: 40 },
  exhaustive: { min: 40, max: 80 },
};

// Display labels for density options
export const DENSITY_LABELS: Record<DensityLevel, string> = {
  sparse: 'Core',
  standard: 'Standard',
  dense: 'Deep',
  exhaustive: 'Full',
};

// Subtitle descriptions for each density level
export const DENSITY_DESCRIPTIONS: Record<DensityLevel, string> = {
  sparse: '3 levels',
  standard: '5 levels',
  dense: '10 levels',
  exhaustive: '15 levels',
};

// Layout spacing defaults (in pixels, matching text node dimensions)
export const LAYOUT_DEFAULTS = {
  nodeHeight: 32,
  charWidth: 9,         // approximate px per character at 16px Inter Medium
  minNodeWidth: 60,     // minimum node width for short labels
  hierarchical: { rankSep: 120, nodeSep: 40 },
  radial: { ringGap: 220 },
  cluster: { clusterGap: 200, intraClusterGap: 30 },
};

// Estimate the pixel width of a text node based on label length
export function estimateNodeWidth(label: string): number {
  return Math.max(
    LAYOUT_DEFAULTS.minNodeWidth,
    label.length * LAYOUT_DEFAULTS.charWidth + 16 // 16px padding
  );
}

export const SECTION_PADDING = 100;

// Default model options per provider
export const MODEL_OPTIONS: Record<string, { label: string; value: string }[]> = {
  claude: [
    { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
    { label: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
  ],
  gemini: [
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 3.1 Pro Preview', value: 'gemini-3.1-pro-preview' },
    { label: 'Gemini 3.1 Flash Lite Preview', value: 'gemini-3.1-flash-lite-preview' },
  ],
};
