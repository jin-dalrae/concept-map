import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import type { LayoutResult } from './index';
import { LAYOUT_DEFAULTS, estimateNodeWidth } from '../../shared/constants';

const ROW_HEIGHT = LAYOUT_DEFAULTS.nodeHeight + 50; // vertical gap between rows
const CLUSTER_GAP = LAYOUT_DEFAULTS.cluster.clusterGap;
const NODE_PAD = 40; // horizontal gap between nodes within a cluster

export function layoutCluster(
  nodes: ConceptNode[],
  _edges: ConceptEdge[],
  _config: LayoutConfig
): LayoutResult {
  if (nodes.length === 0) return { nodes: [] };

  // Group nodes by type (sorted: most nodes first for better 2×2 packing)
  const groups = new Map<string, ConceptNode[]>();
  for (const node of nodes) {
    const group = groups.get(node.type) ?? [];
    group.push(node);
    groups.set(node.type, group);
  }

  const clusterEntries = [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  // Arrange clusters in a 2×2 grid
  const gridCols = Math.min(2, clusterEntries.length);
  const result: (ConceptNode & { x: number; y: number })[] = [];

  // First pass: compute each cluster's bounding size
  const clusterSizes: { w: number; h: number }[] = [];
  for (const [, groupNodes] of clusterEntries) {
    const cols = Math.ceil(Math.sqrt(groupNodes.length));
    const rows = Math.ceil(groupNodes.length / cols);
    // Use max node width in this cluster for uniform column spacing
    const maxW = groupNodes.reduce(
      (max, n) => Math.max(max, estimateNodeWidth(n.label)),
      LAYOUT_DEFAULTS.minNodeWidth
    );
    clusterSizes.push({
      w: cols * (maxW + NODE_PAD),
      h: rows * ROW_HEIGHT,
    });
  }

  // Compute max widths per grid column and max heights per grid row
  const colWidths: number[] = [0, 0];
  const rowHeights: number[] = [0, 0];
  for (let ci = 0; ci < clusterEntries.length; ci++) {
    const gc = ci % gridCols;
    const gr = Math.floor(ci / gridCols);
    colWidths[gc] = Math.max(colWidths[gc] || 0, clusterSizes[ci].w);
    rowHeights[gr] = Math.max(rowHeights[gr] || 0, clusterSizes[ci].h);
  }

  // Second pass: place each cluster
  for (let ci = 0; ci < clusterEntries.length; ci++) {
    const [, groupNodes] = clusterEntries[ci];
    const gc = ci % gridCols;
    const gr = Math.floor(ci / gridCols);

    // Cluster origin
    let clusterX = 0;
    for (let c = 0; c < gc; c++) clusterX += colWidths[c] + CLUSTER_GAP;
    let clusterY = 0;
    for (let r = 0; r < gr; r++) clusterY += rowHeights[r] + CLUSTER_GAP;

    // Use max node width in this cluster for uniform columns
    const maxW = groupNodes.reduce(
      (max, n) => Math.max(max, estimateNodeWidth(n.label)),
      LAYOUT_DEFAULTS.minNodeWidth
    );

    // Lay out nodes in this cluster as a grid
    const cols = Math.ceil(Math.sqrt(groupNodes.length));
    for (let i = 0; i < groupNodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      result.push({
        ...groupNodes[i],
        x: clusterX + col * (maxW + NODE_PAD),
        y: clusterY + row * ROW_HEIGHT,
      });
    }
  }

  return { nodes: result };
}
