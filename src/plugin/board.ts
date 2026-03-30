import type { GenerateMapPayload } from '../shared/messages';
import type { ConceptNode } from '../shared/types';
import { NODE_COLORS, SECTION_PADDING } from '../shared/constants';

const FONT: FontName = { family: 'Inter', style: 'Medium' };
const FONT_REGULAR: FontName = { family: 'Inter', style: 'Regular' };

export async function createMapOnBoard(payload: GenerateMapPayload): Promise<void> {
  const { nodes, edges, title } = payload;

  // Load fonts needed for sticky notes and connector labels
  await Promise.all([
    figma.loadFontAsync(FONT),
    figma.loadFontAsync(FONT_REGULAR),
  ]);

  // Create a section to group the entire concept map
  const section = figma.createSection();
  section.name = title || 'Concept Map';

  // Track concept ID -> FigJam sticky node ID
  const nodeIdMap = new Map<string, string>();

  // Create sticky notes
  for (const node of nodes) {
    const sticky = figma.createSticky();
    sticky.x = node.x;
    sticky.y = node.y;

    // Color by type
    const color = NODE_COLORS[node.type] ?? NODE_COLORS.concept;
    sticky.fills = [{ type: 'SOLID', color }];

    // Set label text
    sticky.text.fontName = FONT;
    sticky.text.characters = node.label;

    // Use wide width for longer labels
    if (node.label.length > 16) {
      sticky.isWideWidth = true;
    }

    sticky.authorVisible = false;

    section.appendChild(sticky);
    nodeIdMap.set(node.id, sticky.id);
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

    connector.connectorLineType = 'ELBOWED';
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
    bounds.height + SECTION_PADDING * 2
  );

  // Select and zoom to the created map
  figma.currentPage.selection = [section];
  figma.viewport.scrollAndZoomIntoView([section]);
}

function computeBounds(nodes: (ConceptNode & { x: number; y: number })[]) {
  const pad = 200; // sticky note approximate size
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + pad);
    maxY = Math.max(maxY, n.y + pad);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
