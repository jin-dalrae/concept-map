import type { ConceptNode, ConceptEdge, LayoutConfig } from '../../shared/types';
import type { LayoutResult } from './index';
import { LAYOUT_DEFAULTS } from '../../shared/constants';

export function layoutRadial(
  nodes: ConceptNode[],
  edges: ConceptEdge[],
  _config: LayoutConfig
): LayoutResult {
  if (nodes.length === 0) return { nodes: [] };
  if (nodes.length === 1) return { nodes: [{ ...nodes[0], x: 0, y: 0 }] };

  // Find the most-connected node as center
  const degreeMap = new Map<string, number>();
  for (const node of nodes) degreeMap.set(node.id, 0);
  for (const edge of edges) {
    degreeMap.set(edge.sourceId, (degreeMap.get(edge.sourceId) ?? 0) + 1);
    degreeMap.set(edge.targetId, (degreeMap.get(edge.targetId) ?? 0) + 1);
  }

  const sorted = [...nodes].sort(
    (a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0)
  );

  const centerNode = sorted[0];
  const outerNodes = sorted.slice(1);
  const ringGap = LAYOUT_DEFAULTS.radial.ringGap;
  const nodesPerRing = 8;

  const result: (ConceptNode & { x: number; y: number })[] = [
    { ...centerNode, x: 0, y: 0 },
  ];

  let ring = 1;
  let idx = 0;
  while (idx < outerNodes.length) {
    const radius = ring * ringGap;
    const count = Math.min(nodesPerRing * ring, outerNodes.length - idx);
    const angleStep = (2 * Math.PI) / count;

    for (let i = 0; i < count && idx < outerNodes.length; i++, idx++) {
      const angle = i * angleStep - Math.PI / 2; // start from top
      result.push({
        ...outerNodes[idx],
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
    ring++;
  }

  return { nodes: result };
}
