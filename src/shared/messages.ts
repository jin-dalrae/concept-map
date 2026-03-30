import type { ConceptNode, ConceptEdge, LayoutType, PluginSettings } from './types';

// --- UI -> Plugin messages ---
export type UIToPluginMessage =
  | { type: 'generate-map'; payload: GenerateMapPayload }
  | { type: 'get-settings' }
  | { type: 'save-settings'; payload: PluginSettings }
  | { type: 'save-feedback'; payload: FeedbackPayload }
  | { type: 'resize-ui'; payload: { width: number; height: number } };

export interface GenerateMapPayload {
  nodes: (ConceptNode & { x: number; y: number })[];
  edges: ConceptEdge[];
  layout: LayoutType;
  title: string;
}

export interface FeedbackPayload {
  useful: boolean;
  issues: string[];
  comment?: string;
}

// --- Plugin -> UI messages ---
export type PluginToUIMessage =
  | { type: 'settings-loaded'; payload: PluginSettings | null }
  | { type: 'map-generated'; payload: { success: boolean; nodeCount: number; edgeCount: number; error?: string } };
