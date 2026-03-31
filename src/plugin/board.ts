import type { GenerateMapPayload } from '../shared/messages';
import type { ConceptNode } from '../shared/types';
import { SECTION_PADDING, estimateNodeWidth, LAYOUT_DEFAULTS } from '../shared/constants';

const FONT_MEDIUM: FontName = { family: 'Inter', style: 'Medium' };
const FONT_REGULAR: FontName = { family: 'Inter', style: 'Regular' };

const TITLE_OFFSET_Y = 80; // space below section title so nodes don't overlap it

export async function createMapOnBoard(payload: GenerateMapPayload): Promise<void> {
  const { nodes, edges, title } = payload;

  // Load fonts for text nodes and connector labels
  await Promise.all([
    figma.loadFontAsync(FONT_MEDIUM),
    figma.loadFontAsync(FONT_REGULAR),
  ]);

  // Create a section to group the entire concept map
  const section = figma.createSection();
  section.name = title || 'Concept Map';

  // Track concept ID -> FigJam node ID
  const nodeIdMap = new Map<string, string>();

  // Create text nodes for each concept
  for (const node of nodes) {
    const textNode = figma.createText();
    textNode.fontName = FONT_MEDIUM;
    textNode.characters = node.label;
    textNode.fontSize = 16;
    textNode.textAlignHorizontal = 'CENTER';
    textNode.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 } }];

    // Position with title offset
    textNode.x = node.x;
    textNode.y = node.y + TITLE_OFFSET_Y;

    section.appendChild(textNode);
    nodeIdMap.set(node.id, textNode.id);
  }

  // Create connectors
  for (const edge of edges) {
    const startNodeId = nodeIdMap.get(edge.sourceId);
    const endNodeId = nodeIdMap.get(edge.targetId);
    if (!startNodeId || !endNodeId) continue;

    const connector = figma.createConnector();
    connector.connectorStart = {
      endpointNodeId: startNodeId,
      magnet: 'AUTO',
    };
    connector.connectorEnd = {
      endpointNodeId: endNodeId,
      magnet: 'AUTO',
    };

    connector.connectorLineType = 'CURVE';
    connector.strokeWeight = 1.5;
    connector.connectorEndStrokeCap = 'ARROW_LINES';

    // Set edge label
    if (edge.label) {
      connector.text.fontName = FONT_REGULAR;
      connector.text.characters = edge.label;
      connector.text.fontSize = 11;
    }

    section.appendChild(connector);
  }

  // Resize section to fit all content
  const bounds = computeBounds(nodes);
  section.x = bounds.minX - SECTION_PADDING;
  section.y = bounds.minY - SECTION_PADDING;
  section.resizeWithoutConstraints(
    bounds.width + SECTION_PADDING * 2,
    bounds.height + TITLE_OFFSET_Y + SECTION_PADDING * 2
  );

  // Select and zoom to the created map
  figma.currentPage.selection = [section];
  figma.viewport.scrollAndZoomIntoView([section]);
}

function computeBounds(nodes: (ConceptNode & { x: number; y: number })[]) {
  const nodeH = LAYOUT_DEFAULTS.nodeHeight;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const nodeW = estimateNodeWidth(n.label);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + nodeW);
    maxY = Math.max(maxY, n.y + nodeH);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
