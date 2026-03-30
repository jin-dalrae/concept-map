import type { ExtractionRequest } from '../../shared/types';
import { DENSITY_RANGES } from '../../shared/constants';

export function buildExtractionPrompt(request: ExtractionRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  const range = DENSITY_RANGES[request.density];
  const isExhaustive = request.density === 'exhaustive';

  const focusClause = request.focusQuery
    ? `\nFocus especially on concepts related to: "${request.focusQuery}". Prioritize nodes and relationships relevant to this focus.`
    : '';

  const exhaustiveClause = isExhaustive
    ? `\n\nIMPORTANT — EXHAUSTIVE MODE: Capture virtually ALL information from the article. Every distinct claim, fact, actor, process, outcome, statistic, example, and argument should become a node. Every stated or implied relationship should become an edge. Do NOT summarize or skip details — be comprehensive. If the article mentions a number, a name, a place, a date, a cause, an effect, a comparison, or a qualification, it should appear in the map. Aim for at least ${range.min} nodes but extract more if the article warrants it. It is better to over-extract than to miss information.`
    : '';

  const systemPrompt = `You are a concept map extraction engine. Given article text, you extract a structured concept map as JSON.

Rules:
- Extract between ${range.min} and ${range.max} concept nodes.
- Each node has: id (short kebab-case like "n1"), label (concise noun phrase, 1-4 words), type (one of: concept, actor, process, outcome), description (1 sentence explaining this concept in context), sourceQuote (exact quote from the article that supports this node, 5-20 words).
- Each edge has: id (like "e1"), sourceId, targetId, label (active-voice verb phrase, 1-3 words, e.g. "enables", "contradicts", "is measured by"), sourceQuote (exact quote supporting this relationship), weight (0.0-1.0 importance).
- For each node and edge, the sourceQuote MUST be an exact quote from the article. If you cannot find a supporting quote, do not include the node/edge.
- When the same concept appears in multiple forms (plurals, pronouns, abbreviations, paraphrases), use a single canonical label. Do not create separate nodes for variants.
- Also provide: title (concise map title, 3-6 words), summary (1-2 sentence summary).${focusClause}${exhaustiveClause}

Output ONLY valid JSON matching this exact schema (no markdown fences, no extra text):
{
  "title": "string",
  "summary": "string",
  "nodes": [{ "id": "string", "label": "string", "type": "concept|actor|process|outcome", "description": "string", "sourceQuote": "string" }],
  "edges": [{ "id": "string", "sourceId": "string", "targetId": "string", "label": "string", "sourceQuote": "string", "weight": 0.0 }]
}`;

  const userPrompt = `Extract a concept map from this article:\n\n${request.text}`;

  return { systemPrompt, userPrompt };
}

export function buildCanonicalizationPrompt(labels: string[]): string {
  return `Given these concept labels extracted from an article, identify any that refer to the same concept (synonyms, abbreviations, singular/plural forms, paraphrases) and map them to a single canonical label.

Labels: ${JSON.stringify(labels)}

Return ONLY valid JSON (no markdown fences):
{
  "mappings": {
    "original_label": "canonical_label"
  }
}

Only include labels that should be mapped to a different canonical form. Omit labels that are already canonical.`;
}
