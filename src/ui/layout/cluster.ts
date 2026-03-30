import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import type { LayoutResult } from './index';
import { LAYOUT_DEFAULTS } from '../../shared/constants';

export function layoutCluster(
  nodes: ConceptNode[],
  _edges: ConceptEdge[],
  _config: LayoutConfig
): LayoutResult {
  if (nodes.length === 0) return { nodes: [] };

  // Group nodes by type
  const groups = new Map<string, ConceptNode[]>();
  for (const node of nodes) {
    const group = groups.get(node.type) ?? [];
    group.push(node);
    groups.set(node.type, group);
  }

  const clusterGap = LAYOUT_DEFAULTS.cluster.clusterGap;
  const intraGap = LAYOUT_DEFAULTS.cluster.intraClusterGap;
  const stickySize = LAYOUT_DEFAULTS.stickyWidth;

  const result: (ConceptNode & { x: number; y: number })[] = [];
  let clusterX = 0;

  for (const [, groupNodes] of groups) {
    const cols = Math.ceil(Math.sqrt(groupNodes.length));

    for (let i = 0; i < groupNodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      result.push({
        ...groupNodes[i],
        x: clusterX + col * (stickySize + intraGap),
        y: row * (stickySize + intraGap),
      });
    }

    // Advance to next cluster
    const usedCols = Math.min(groupNodes.length, cols);
    clusterX += usedCols * (stickySize + intraGap) + clusterGap;
  }

  return { nodes: result };
}
