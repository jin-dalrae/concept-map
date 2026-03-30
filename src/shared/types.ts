// --- Node Types ---
export type ConceptNodeType =
  | 'concept'
  | 'actor'
  | 'process'
  | 'outcome';

export interface ConceptNode {
  id: string;
  label: string;
  type: ConceptNodeType;
  description: string;
  sourceQuote: string;
  sourceCharOffset?: [number, number];
  x?: number;
  y?: number;
}

export interface ConceptEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  sourceQuote: string;
  weight: number;
}

export interface ConceptMap {
  title: string;
  summary: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

// --- Dedup ---
export interface MergeSuggestion {
  nodeIds: string[];
  canonicalLabel: string;
  reason: string;
  accepted: boolean | null;
}

// --- Layout ---
export type LayoutType = 'radial' | 'hierarchical' | 'cluster';
export type DensityLevel = 'sparse' | 'standard' | 'dense' | 'exhaustive';

export interface LayoutConfig {
  type: LayoutType;
  nodeSpacing: number;
  rankSpacing: number;
}

// --- Settings ---
export type LLMProvider = 'claude' | 'gemini';

export interface PluginSettings {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  density: DensityLevel;
  layout: LayoutType;
}

// --- Extraction ---
export interface ExtractionRequest {
  text: string;
  focusQuery?: string;
  density: DensityLevel;
}

export interface ExtractionResult {
  map: ConceptMap;
  mergeSuggestions: MergeSuggestion[];
  tokenUsage: { input: number; output: number };
}
