import dagre from '@dagrejs/dagre';
import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import type { LayoutResult } from './index';
import { LAYOUT_DEFAULTS } from '../../shared/constants';

export function layoutHierarchical(
  nodes: ConceptNode[],
  edges: ConceptEdge[],
  _config: LayoutConfig
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    ranksep: LAYOUT_DEFAULTS.hierarchical.rankSep,
    nodesep: LAYOUT_DEFAULTS.hierarchical.nodeSep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const w = LAYOUT_DEFAULTS.stickyWidth;
  const h = LAYOUT_DEFAULTS.stickyHeight;

  for (const node of nodes) {
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    // Only add edge if both nodes exist
    if (g.hasNode(edge.sourceId) && g.hasNode(edge.targetId)) {
      g.setEdge(edge.sourceId, edge.targetId);
    }
  }

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const dagreNode = g.node(node.id);
      return {
        ...node,
        x: (dagreNode?.x ?? 0) - w / 2,
        y: (dagreNode?.y ?? 0) - h / 2,
      };
    }),
  };
}
