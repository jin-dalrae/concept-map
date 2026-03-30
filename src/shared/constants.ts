import type { ConceptNodeType, DensityLevel } from './types';

// FigJam sticky note colors (RGB 0-1) mapped to concept node types
export const NODE_COLORS: Record<ConceptNodeType, { r: number; g: number; b: number }> = {
  concept: { r: 1.0, g: 0.87, b: 0.36 },   // Yellow
  actor:   { r: 0.76, g: 0.61, b: 0.92 },   // Purple
  process: { r: 0.51, g: 0.83, b: 0.98 },   // Blue
  outcome: { r: 0.56, g: 0.93, b: 0.56 },   // Green
};

// How many nodes to extract per density level
export const DENSITY_RANGES: Record<DensityLevel, { min: number; max: number }> = {
  sparse:     { min: 5, max: 8 },
  standard:   { min: 10, max: 16 },
  dense:      { min: 20, max: 30 },
  exhaustive: { min: 35, max: 60 },
};

// Display labels for density options
export const DENSITY_LABELS: Record<DensityLevel, string> = {
  sparse: 'Sparse',
  standard: 'Standard',
  dense: 'Dense',
  exhaustive: 'All',
};

// Layout spacing defaults (in pixels, matching FigJam sticky default ~200px)
export const LAYOUT_DEFAULTS = {
  stickyWidth: 200,
  stickyHeight: 200,
  hierarchical: { rankSep: 160, nodeSep: 100 },
  radial: { ringGap: 280 },
  cluster: { clusterGap: 350, intraClusterGap: 40 },
};

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
