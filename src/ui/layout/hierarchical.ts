import dagre from '@dagrejs/dagre';
import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import type { LayoutResult } from './index';
import { LAYOUT_DEFAULTS, estimateNodeWidth } from '../../shared/constants';

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

  const h = LAYOUT_DEFAULTS.nodeHeight;

  // Use dynamic width per node based on label length
  const nodeWidths = new Map<string, number>();
  for (const node of nodes) {
    const w = estimateNodeWidth(node.label);
    nodeWidths.set(node.id, w);
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.sourceId) && g.hasNode(edge.targetId)) {
      g.setEdge(edge.sourceId, edge.targetId);
    }
  }

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const dagreNode = g.node(node.id);
      const w = nodeWidths.get(node.id) ?? LAYOUT_DEFAULTS.minNodeWidth;
      return {
        ...node,
        x: (dagreNode?.x ?? 0) - w / 2,
        y: (dagreNode?.y ?? 0) - h / 2,
      };
    }),
  };
}
