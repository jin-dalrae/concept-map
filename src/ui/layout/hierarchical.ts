import dagre from '@dagrejs/dagre';
import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import type { LayoutResult } from './index';
import { LAYOUT_DEFAULTS } from '../../shared/constants';
import { computeNodeSize } from '../../shared/nodeSize';

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

  for (const node of nodes) {
    const { width, height } = computeNodeSize(node.label);
    g.setNode(node.id, { width, height });
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
      const { width, height } = computeNodeSize(node.label);
      return {
        ...node,
        x: (dagreNode?.x ?? 0) - width / 2,
        y: (dagreNode?.y ?? 0) - height / 2,
      };
    }),
  };
}
