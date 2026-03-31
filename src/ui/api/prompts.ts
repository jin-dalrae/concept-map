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
- Use wording from the article. Minor simplifications (e.g. removing "which is") are okay, but do NOT abbreviate or summarize.
- Each node has: id (short kebab-case like "n1"), label (noun phrase based on the article), type (one of: concept, actor, process, outcome), description (1 sentence explaining this concept in context), sourceQuote (exact quote from the article that supports this node, 5-20 words).
- Each edge has: id (like "e1"), sourceId, targetId, label (verb phrase from the article, e.g. "is democratically elected", "proposed using", "sought to integrate"), sourceQuote (exact quote supporting this relationship), weight (0.0-1.0 importance). Do NOT simplify to generic verbs like "causes" or "enables".
- NEVER use pronouns (it, this, that, they, etc.) or vague terms (few, many, some, etc.) as node labels.
- For each node and edge, the sourceQuote MUST be an exact quote from the article. If you cannot find a supporting quote, do not include the node/edge.
- When the same concept appears in multiple forms, use the most complete/specific form from the article.
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

// ────────────────────────────────────────────────
// Breadth-first expansion prompts
// ────────────────────────────────────────────────

/**
 * Step 1: Extract seed concepts from article summary.
 */
export function buildSeedPrompt(focusQuery?: string): string {
  const focusClause = focusQuery
    ? `\nPay special attention to concepts related to: "${focusQuery}".`
    : '';

  return `You are a concept extraction engine. Given an article, you:
1. Write a concise 2-sentence summary.
2. Write a concise title (3-6 words).
3. Identify the 10-15 most important nouns or noun phrases (proper names, technical terms, key subjects) that represent the core concepts of the article.${focusClause}

Rules for seed concepts:
- Use wording from the article. Minor simplifications (e.g. removing "which is") are okay, but do NOT abbreviate or summarize.
- Each seed must be a specific noun or noun phrase based on the text
- Include proper names, organizations, and key actors
- Include core processes and outcomes mentioned
- NEVER use pronouns (it, this, that, they, etc.) or vague terms (few, many, some, etc.)
- Assign each seed a type: concept, actor, process, or outcome

Output ONLY valid JSON (no markdown fences, no extra text):
{
  "title": "string",
  "summary": "string",
  "seeds": [{ "label": "string", "type": "concept|actor|process|outcome" }]
}`;
}

/**
 * Step 2: Extract relationships from sentences about a set of focus concepts.
 */
export function buildRelationshipPrompt(): string {
  return `You are a relationship extraction engine. Given a set of focus concepts and sentences from an article containing those concepts, extract all subject-verb-object relationships.

Rules:
- Each relationship must be grounded in the given sentences
- Use wording from the sentences. Minor simplifications (e.g. removing "which is") are okay, but do NOT abbreviate or summarize.
- Source and target should be noun phrases based on the sentence
- Relationship label should preserve the verb phrase from the sentence (e.g. "is democratically elected", "proposed using", "sought to integrate"). Do NOT simplify to generic verbs like "causes" or "enables".
- NEVER use pronouns (it, this, that, they, etc.) or vague terms (few, many, some, etc.) as source or target
- Assign each noun a type: concept, actor, process, or outcome
- Do NOT duplicate relationships. If the same source→target pair appears, keep the most informative verb.
- Include ALL relationships you can find — be thorough
- The "newConcepts" array lists important nouns found in these sentences that were NOT in the focus concepts list. Use EXACT wording.

Output ONLY valid JSON (no markdown fences, no extra text):
{
  "relationships": [
    {
      "source": "string",
      "target": "string",
      "label": "string",
      "sourceType": "concept|actor|process|outcome",
      "targetType": "concept|actor|process|outcome",
      "sentence": "string"
    }
  ],
  "newConcepts": [{ "label": "string", "type": "concept|actor|process|outcome" }]
}`;
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
