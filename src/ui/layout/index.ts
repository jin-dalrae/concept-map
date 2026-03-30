import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import { layoutHierarchical } from './hierarchical';
import { layoutRadial } from './radial';
import { layoutCluster } from './cluster';

export interface LayoutResult {
  nodes: (ConceptNode & { x: number; y: number })[];
}

export function computeLayout(
  nodes: ConceptNode[],
  edges: ConceptEdge[],
  config: LayoutConfig
): LayoutResult {
  switch (config.type) {
    case 'hierarchical':
      return layoutHierarchical(nodes, edges, config);
    case 'radial':
      return layoutRadial(nodes, edges, config);
    case 'cluster':
      return layoutCluster(nodes, edges, config);
    default:
      return layoutRadial(nodes, edges, config);
  }
}
