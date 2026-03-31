import type { GenerateMapPayload } from '../shared/messages';
import type { ConceptNode } from '../shared/types';
import { SECTION_PADDING } from '../shared/constants';
import { computeNodeSize } from '../shared/nodeSize';

// Single neutral color for all nodes (light blue-gray)
const NODE_COLOR = { r: 0.93, g: 0.95, b: 0.98 };

const FONT: FontName = { family: 'Inter', style: 'Medium' };
const FONT_REGULAR: FontName = { family: 'Inter', style: 'Regular' };

const TITLE_OFFSET_Y = 80; // space below section title so nodes don't overlap it

export async function createMapOnBoard(payload: GenerateMapPayload): Promise<void> {
  const { nodes, edges, title } = payload;

  // Load fonts needed for text boxes and connector labels
  await Promise.all([
    figma.loadFontAsync(FONT),
    figma.loadFontAsync(FONT_REGULAR),
  ]);

  // Create a section to group the entire concept map
  const section = figma.createSection();
  section.name = title || 'Concept Map';

  // Track concept ID -> FigJam node ID, and actual dimensions for bounds
  const nodeIdMap = new Map<string, string>();
  const nodeWidths = new Map<string, number>();
  const nodeHeights = new Map<string, number>();

  // Create text boxes (rounded rectangles)
  for (const node of nodes) {
    const shape = figma.createShapeWithText();
    shape.shapeType = 'ROUNDED_RECTANGLE';

    // Size to fit text on single line
    const { width, height } = computeNodeSize(node.label);
    shape.resize(width, height);

    // Offset Y so nodes sit below the section title
    shape.x = node.x;
    shape.y = node.y + TITLE_OFFSET_Y;

    // Uniform color — no type-based coloring
    shape.fills = [{ type: 'SOLID', color: NODE_COLOR }];

    // Set label text (single line, no wrapping)
    shape.text.fontName = FONT;
    shape.text.characters = node.label;
    shape.text.fontSize = 12;
    section.appendChild(shape);
    nodeIdMap.set(node.id, shape.id);
    nodeWidths.set(node.id, width);
    nodeHeights.set(node.id, height);
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

    connector.connectorLineType = 'CURVED';
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

  // Resize section to fit all content (account for title offset)
  const bounds = computeBounds(nodes, nodeWidths, nodeHeights);
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

function computeBounds(
  nodes: (ConceptNode & { x: number; y: number })[],
  nodeWidths: Map<string, number>,
  nodeHeights: Map<string, number>
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const w = nodeWidths.get(n.id) || 160;
    const h = nodeHeights.get(n.id) || 46;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
