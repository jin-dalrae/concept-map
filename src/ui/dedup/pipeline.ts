import type { ConceptNode, MergeSuggestion } from '../../shared/types';
import type { LLMClient } from '../api/provider';
import { normalizeLemma } from './lemmatize';
import { findSimilarPairs } from './similarity';

/**
 * Three-stage dedup pipeline:
 * 1. Lemmatization-based grouping (catches plurals, case)
 * 2. LLM canonicalization (catches synonyms, abbreviations)
 * 3. String similarity (catches typos, near-matches)
 */
export async function runDedupPipeline(
  nodes: ConceptNode[],
  llmClient: LLMClient
): Promise<MergeSuggestion[]> {
  const suggestions: MergeSuggestion[] = [];

  // Stage 1: Lemmatization
  const lemmaGroups = groupByLemma(nodes);
  for (const group of lemmaGroups) {
    if (group.length > 1) {
      // Pick the shortest label as canonical
      const sorted = [...group].sort((a, b) => a.label.length - b.label.length);
      suggestions.push({
        nodeIds: group.map((n) => n.id),
        canonicalLabel: sorted[0].label,
        reason: 'Same root form (singular/plural variant)',
        accepted: null,
      });
    }
  }

  // Stage 2: LLM canonicalization
  const labels = nodes.map((n) => n.label);
  try {
    const mappings = await llmClient.canonicalizeLabels(labels);
    const reverseMap = new Map<string, string[]>();
    for (const [original, canonical] of mappings) {
      if (original.toLowerCase() !== canonical.toLowerCase()) {
        const group = reverseMap.get(canonical) ?? [];
        group.push(original);
        reverseMap.set(canonical, group);
      }
    }
    for (const [canonical, originals] of reverseMap) {
      const nodeIds = originals
        .map((label) => nodes.find((n) => n.label === label)?.id)
        .filter((id): id is string => !!id);
      // Also include the canonical node itself if it exists
      const canonicalNode = nodes.find(
        (n) => n.label.toLowerCase() === canonical.toLowerCase()
      );
      if (canonicalNode && !nodeIds.includes(canonicalNode.id)) {
        nodeIds.push(canonicalNode.id);
      }
      if (nodeIds.length > 1) {
        const alreadySuggested = suggestions.some((s) =>
          nodeIds.every((id) => s.nodeIds.includes(id))
        );
        if (!alreadySuggested) {
          suggestions.push({
            nodeIds,
            canonicalLabel: canonical,
            reason: 'AI identified as same concept',
            accepted: null,
          });
        }
      }
    }
  } catch (err) {
    console.warn('LLM canonicalization failed, skipping:', err);
  }

  // Stage 3: String similarity
  const similarPairs = findSimilarPairs(
    nodes.map((n) => n.label),
    0.85
  );
  for (const [i, j] of similarPairs) {
    const nodeIds = [nodes[i].id, nodes[j].id];
    const alreadySuggested = suggestions.some((s) =>
      nodeIds.every((id) => s.nodeIds.includes(id))
    );
    if (!alreadySuggested) {
      suggestions.push({
        nodeIds,
        canonicalLabel:
          nodes[i].label.length <= nodes[j].label.length
            ? nodes[i].label
            : nodes[j].label,
        reason: 'High string similarity',
        accepted: null,
      });
    }
  }

  return suggestions;
}

function groupByLemma(nodes: ConceptNode[]): ConceptNode[][] {
  const groups = new Map<string, ConceptNode[]>();
  for (const node of nodes) {
    const lemma = normalizeLemma(node.label);
    const group = groups.get(lemma) ?? [];
    group.push(node);
    groups.set(lemma, group);
  }
  return Array.from(groups.values());
}
