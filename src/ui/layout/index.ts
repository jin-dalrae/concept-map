import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import { layoutHierarchical } from './hierarchical';

export interface LayoutResult {
  nodes: (ConceptNode & { x: number; y: number })[];
}

export function computeLayout(
  nodes: ConceptNode[],
  edges: ConceptEdge[],
  config: LayoutConfig
): LayoutResult {
  return layoutHierarchical(nodes, edges, config);
}
