import { useState, useCallback } from 'react';
import type {
  ConceptMap,
  ConceptNode,
  ConceptEdge,
  MergeSuggestion,
  ExtractionRequest,
  PluginSettings,
  ConceptNodeType,
} from '../../shared/types';
import { createLLMClient } from '../api/provider';
import type { LLMClient } from '../api/provider';
import { runDedupPipeline } from '../dedup/pipeline';
import { normalizeLemma } from '../dedup/lemmatize';
import { buildSeedPrompt, buildRelationshipPrompt } from '../api/prompts';
import { splitSentences, findSentencesForConcepts } from '../text/sentences';

// Density → how many BFS expansion levels
const DEPTH_MAP: Record<string, number> = {
  sparse: 6,
  standard: 10,
  dense: 15,
  exhaustive: 20,
};

interface ExtractionState {
  loading: boolean;
  expanding: boolean;
  progress: string;
  map: ConceptMap | null;
  suggestions: MergeSuggestion[];
  error: string | null;
}

export function useExtraction(settings: PluginSettings | null) {
  const [state, setState] = useState<ExtractionState>({
    loading: false,
    expanding: false,
    progress: '',
    map: null,
    suggestions: [],
    error: null,
  });

  const extract = useCallback(
    async (request: ExtractionRequest) => {
      if (!settings?.apiKey) {
        setState((s) => ({ ...s, error: 'Please set your API key in Settings.' }));
        return;
      }

      setState({
        loading: true,
        progress: 'Analyzing article...',
        map: null,
        suggestions: [],
        error: null,
      });

      try {
        const client = createLLMClient(settings.provider, {
          apiKey: settings.apiKey,
          model: settings.model,
        });

        // ═══════════════════════════════════════════
        // BREADTH-FIRST CONCEPT EXTRACTION
        // ═══════════════════════════════════════════

        const maxDepth = DEPTH_MAP[request.density] || 2;
        const sentences = splitSentences(request.text);
        console.log('[ConceptMap] Split article into', sentences.length, 'sentences');

        // Step 1: Extract seed concepts
        setState((s) => ({ ...s, progress: 'Finding key concepts...' }));
        let seedResult: { title: string; summary: string; seeds: { label: string; type: string }[] };
        try {
          seedResult = await extractSeeds(client, request.text, request.focusQuery);
        } catch (err) {
          throw new Error('Failed to extract seed concepts: ' + (err instanceof Error ? err.message : String(err)));
        }
        if (!seedResult.seeds || seedResult.seeds.length === 0) {
          throw new Error('AI returned no seed concepts. Try a different article or density.');
        }
        console.log('[ConceptMap] Seeds:', seedResult.seeds.map((s: any) => s.label));

        // Initialize the graph
        const nodeMap = new Map<string, ConceptNode>(); // label (lowercase) → node
        const edges: ConceptEdge[] = [];
        let nodeCounter = 1;
        let edgeCounter = 1;

        // Add seed nodes
        for (const seed of seedResult.seeds) {
          const key = seed.label.toLowerCase();
          if (!nodeMap.has(key)) {
            nodeMap.set(key, {
              id: `n${nodeCounter++}`,
              label: seed.label,
              type: validType(seed.type),
              description: '',
              sourceQuote: '',
            });
          }
        }

        // BFS expansion loop
        let frontier = seedResult.seeds.map((s: any) => s.label as string);
        const explored = new Set<string>(frontier.map((f: string) => f.toLowerCase()));

        // Cap sentences sent to LLM per level to avoid enormous prompts
        const MAX_SENTENCES_PER_LEVEL = 100;

        for (let depth = 0; depth < maxDepth; depth++) {
          if (frontier.length === 0) break;

          setState((s) => ({
            ...s,
            progress: `Expanding network (level ${depth + 1}/${maxDepth})... ${nodeMap.size} concepts found`,
          }));

          // Find sentences containing frontier concepts
          const conceptSentences = findSentencesForConcepts(sentences, frontier);

          // Build sentence context for the LLM (capped)
          const sentenceContext = buildSentenceContext(frontier, conceptSentences, MAX_SENTENCES_PER_LEVEL);

          if (sentenceContext.trim().length === 0) {
            console.log('[ConceptMap] No sentences found for frontier, stopping');
            break;
          }

          // Extract relationships — wrapped in try/catch so one bad level doesn't kill everything
          let rels: {
            relationships: any[];
            newConcepts: any[];
          };
          try {
            rels = await extractRelationships(client, frontier, sentenceContext);
          } catch (err) {
            console.warn(`[ConceptMap] Level ${depth + 1} extraction failed, skipping:`, err);
            // Still continue with remaining frontier on next level
            frontier = [];
            continue;
          }

          // Process relationships into nodes + edges
          const newConcepts: string[] = [];
          for (const rel of rels.relationships || []) {
            const srcLabel = rel.source?.trim();
            const tgtLabel = rel.target?.trim();
            const edgeLabel = rel.label?.trim();
            if (!srcLabel || !tgtLabel || !edgeLabel) continue;

            // Ensure source node exists
            const srcKey = srcLabel.toLowerCase();
            if (!nodeMap.has(srcKey)) {
              nodeMap.set(srcKey, {
                id: `n${nodeCounter++}`,
                label: srcLabel,
                type: validType(rel.sourceType),
                description: '',
                sourceQuote: rel.sentence || '',
              });
            }

            // Ensure target node exists
            const tgtKey = tgtLabel.toLowerCase();
            if (!nodeMap.has(tgtKey)) {
              nodeMap.set(tgtKey, {
                id: `n${nodeCounter++}`,
                label: tgtLabel,
                type: validType(rel.targetType),
                description: '',
                sourceQuote: rel.sentence || '',
              });
            }

            // Add edge (avoid duplicates)
            const srcId = nodeMap.get(srcKey)!.id;
            const tgtId = nodeMap.get(tgtKey)!.id;
            if (srcId !== tgtId) {
              const edgeExists = edges.some(
                (e) => e.sourceId === srcId && e.targetId === tgtId
              );
              if (!edgeExists) {
                edges.push({
                  id: `e${edgeCounter++}`,
                  sourceId: srcId,
                  targetId: tgtId,
                  label: edgeLabel,
                  sourceQuote: rel.sentence || '',
                  weight: 0.5,
                });
              }
            }

            // Track new concepts for next frontier
            if (!explored.has(srcKey)) newConcepts.push(srcLabel);
            if (!explored.has(tgtKey)) newConcepts.push(tgtLabel);
          }

          // Also include LLM-suggested new concepts
          for (const nc of rels.newConcepts || []) {
            const label = typeof nc === 'string' ? nc : nc.label;
            if (label && !explored.has(label.toLowerCase())) {
              newConcepts.push(label);
            }
          }

          // Update frontier for next level — only unexplored concepts
          frontier = [...new Set(newConcepts.filter((c) => {
            const key = c.toLowerCase();
            if (explored.has(key)) return false;
            explored.add(key);
            return true;
          }))];

          console.log(`[ConceptMap] Level ${depth + 1}: ${rels.relationships?.length || 0} relationships, ${frontier.length} new concepts for next level`);
        }

        // Build final ConceptMap
        const rawMap: ConceptMap = {
          title: seedResult.title || 'Concept Map',
          summary: seedResult.summary || '',
          nodes: Array.from(nodeMap.values()),
          edges,
        };

        console.log('[ConceptMap] Raw BFS map:', rawMap.nodes.length, 'nodes,', rawMap.edges.length, 'edges');

        // Clean up: validate, remove orphans, auto-merge
        const cleanedMap = validateAndCleanMap(rawMap);
        setState((s) => ({ ...s, progress: 'Merging duplicates...' }));
        const mergedMap = autoMergeDuplicates(cleanedMap);
        console.log('[ConceptMap] After cleanup:', mergedMap.nodes.length, 'nodes,', mergedMap.edges.length, 'edges');

        // Run dedup pipeline for remaining suggestions
        setState((s) => ({ ...s, progress: 'Checking for duplicates...' }));
        let suggestions: MergeSuggestion[] = [];
        try {
          suggestions = await runDedupPipeline(mergedMap.nodes, client);
        } catch (err) {
          console.warn('Dedup pipeline failed, continuing without:', err);
        }

        setState({
          loading: false,
          progress: '',
          map: mergedMap,
          suggestions,
          error: null,
        });
      } catch (err) {
        // If we managed to extract some nodes before failing, return a partial map
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[ConceptMap] Extraction error:', errMsg);
        setState({
          loading: false,
          progress: '',
          map: null,
          suggestions: [],
          error: errMsg,
        });
      }
    },
    [settings]
  );

  const expand = useCallback(
    async (articleText: string) => {
      if (!settings?.apiKey || !state.map) return;

      setState((s) => ({ ...s, expanding: true, progress: 'Finding uncovered content...' }));

      try {
        const client = createLLMClient(settings.provider, {
          apiKey: settings.apiKey,
          model: settings.model,
        });

        const sentences = splitSentences(articleText);
        const existingQuotes = [
          ...state.map.nodes.map((n) => n.sourceQuote?.toLowerCase()).filter(Boolean),
          ...state.map.edges.map((e) => e.sourceQuote?.toLowerCase()).filter(Boolean),
        ];

        // Find uncovered sentences
        const uncoveredSentences = sentences.filter((sent) => {
          const sentLower = sent.toLowerCase();
          return !existingQuotes.some((q) => sentLower.includes(q) || q.includes(sentLower));
        });

        if (uncoveredSentences.length === 0) {
          setState((s) => ({ ...s, expanding: false, progress: '' }));
          return;
        }

        console.log('[ConceptMap] Expanding with', uncoveredSentences.length, 'uncovered sentences');

        // Use existing concept labels as seeds for expansion
        const existingLabels = state.map.nodes.map((n) => n.label);
        const sentenceContext = uncoveredSentences.slice(0, 100).map((s) => `- ${s}`).join('\n');

        setState((s) => ({ ...s, progress: 'Extracting from uncovered sentences...' }));

        let rels: { relationships: any[]; newConcepts: any[] };
        try {
          rels = await extractRelationships(client, existingLabels.slice(0, 20), sentenceContext);
        } catch (err) {
          console.warn('[ConceptMap] Expand extraction failed:', err);
          setState((s) => ({ ...s, expanding: false, error: 'Failed to expand map' }));
          return;
        }

        // Merge new relationships into existing map
        const nodeMap = new Map<string, ConceptNode>();
        for (const node of state.map.nodes) {
          nodeMap.set(node.label.toLowerCase(), node);
        }

        let nodeCounter = state.map.nodes.length + 1;
        let edgeCounter = state.map.edges.length + 1;
        const newEdges: ConceptEdge[] = [...state.map.edges];

        for (const rel of rels.relationships || []) {
          const srcLabel = rel.source?.trim();
          const tgtLabel = rel.target?.trim();
          const edgeLabel = rel.label?.trim();
          if (!srcLabel || !tgtLabel || !edgeLabel) continue;
          if (isInvalidNodeLabel(srcLabel) || isInvalidNodeLabel(tgtLabel)) continue;

          const srcKey = srcLabel.toLowerCase();
          if (!nodeMap.has(srcKey)) {
            nodeMap.set(srcKey, {
              id: `n${nodeCounter++}`,
              label: srcLabel,
              type: validType(rel.sourceType),
              description: '',
              sourceQuote: rel.sentence || '',
            });
          }

          const tgtKey = tgtLabel.toLowerCase();
          if (!nodeMap.has(tgtKey)) {
            nodeMap.set(tgtKey, {
              id: `n${nodeCounter++}`,
              label: tgtLabel,
              type: validType(rel.targetType),
              description: '',
              sourceQuote: rel.sentence || '',
            });
          }

          const srcId = nodeMap.get(srcKey)!.id;
          const tgtId = nodeMap.get(tgtKey)!.id;
          if (srcId !== tgtId) {
            const edgeExists = newEdges.some(
              (e) => e.sourceId === srcId && e.targetId === tgtId
            );
            if (!edgeExists) {
              newEdges.push({
                id: `e${edgeCounter++}`,
                sourceId: srcId,
                targetId: tgtId,
                label: edgeLabel,
                sourceQuote: rel.sentence || '',
                weight: 0.5,
              });
            }
          }
        }

        const expandedMap: ConceptMap = {
          ...state.map,
          nodes: Array.from(nodeMap.values()),
          edges: newEdges,
        };

        const cleanedMap = validateAndCleanMap(expandedMap);
        const mergedMap = autoMergeDuplicates(cleanedMap);

        console.log('[ConceptMap] After expansion:', mergedMap.nodes.length, 'nodes,', mergedMap.edges.length, 'edges');

        setState((s) => ({
          ...s,
          expanding: false,
          progress: '',
          map: mergedMap,
        }));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[ConceptMap] Expand error:', errMsg);
        setState((s) => ({ ...s, expanding: false, error: errMsg }));
      }
    },
    [settings, state.map]
  );

  const updateMap = useCallback((map: ConceptMap) => {
    setState((s) => ({ ...s, map }));
  }, []);

  const updateSuggestions = useCallback((suggestions: MergeSuggestion[]) => {
    setState((s) => ({ ...s, suggestions }));
  }, []);

  return { ...state, extract, expand, updateMap, updateSuggestions };
}

// ─── LLM call helpers ───────────────────────────

async function extractSeeds(
  client: LLMClient,
  articleText: string,
  focusQuery?: string
): Promise<{ title: string; summary: string; seeds: { label: string; type: string }[] }> {
  const systemPrompt = buildSeedPrompt(focusQuery);
  const userPrompt = `Extract seed concepts from this article:\n\n${articleText}`;
  return await client.generateJSON(systemPrompt, userPrompt, 2048);
}

async function extractRelationships(
  client: LLMClient,
  focusConcepts: string[],
  sentenceContext: string
): Promise<{
  relationships: {
    source: string;
    target: string;
    label: string;
    sourceType: string;
    targetType: string;
    sentence: string;
  }[];
  newConcepts: any[];
}> {
  const systemPrompt = buildRelationshipPrompt();
  const userPrompt = `Focus concepts: ${focusConcepts.join(', ')}

Relevant sentences from the article:
${sentenceContext}`;
  return await client.generateJSON(systemPrompt, userPrompt, 8192);
}

// ─── Text helpers ───────────────────────────────

function buildSentenceContext(
  concepts: string[],
  conceptSentences: Map<string, string[]>,
  maxSentences: number = 100
): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const concept of concepts) {
    const sents = conceptSentences.get(concept) || [];
    for (const s of sents) {
      if (!seen.has(s)) {
        seen.add(s);
        lines.push(`- ${s}`);
        if (lines.length >= maxSentences) break;
      }
    }
    if (lines.length >= maxSentences) break;
  }

  return lines.join('\n');
}

function validType(type: any): ConceptNodeType {
  const valid = ['concept', 'actor', 'process', 'outcome'];
  return valid.includes(type) ? type : 'concept';
}

// ─── Post-processing ────────────────────────────

function validateAndCleanMap(map: ConceptMap): ConceptMap {
  const nodes = map.nodes.filter(
    (n) => n && typeof n.id === 'string' && typeof n.label === 'string' && n.label.trim().length > 0
  );

  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges = map.edges.filter(
    (e) =>
      e &&
      nodeIds.has(e.sourceId) &&
      nodeIds.has(e.targetId) &&
      e.sourceId !== e.targetId
  );

  // Remove orphan nodes — but keep at least 50%
  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.sourceId);
    connectedIds.add(e.targetId);
  }
  const connectedNodes = nodes.filter((n) => connectedIds.has(n.id));
  const finalNodes = connectedNodes.length >= nodes.length * 0.5 ? connectedNodes : nodes;

  return { ...map, nodes: finalNodes, edges };
}

// Words that should never become concept nodes
const INVALID_NODE_WORDS = new Set([
  'it', 'this', 'that', 'these', 'those', 'which', 'what', 'who', 'whom',
  'few', 'many', 'some', 'any', 'all', 'most', 'none', 'both', 'each',
  'other', 'others', 'another', 'such', 'same', 'different',
  'he', 'she', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
  'his', 'hers', 'its', 'their', 'our', 'your', 'my',
  'here', 'there', 'where', 'when', 'how', 'why',
  'something', 'anything', 'nothing', 'everything',
  'someone', 'anyone', 'no one', 'everyone',
]);

function isInvalidNodeLabel(label: string): boolean {
  const normalized = label.toLowerCase().trim();
  if (INVALID_NODE_WORDS.has(normalized)) return true;
  // Also reject very short labels (likely abbreviations or pronouns)
  if (normalized.length <= 2) return true;
  return false;
}

function autoMergeDuplicates(map: ConceptMap): ConceptMap {
  // First filter out invalid nodes (pronouns, determiners, etc.)
  const validNodes = map.nodes.filter((n) => !isInvalidNodeLabel(n.label));
  const removedIds = new Set(map.nodes.filter((n) => isInvalidNodeLabel(n.label)).map((n) => n.id));

  // Remove edges connected to invalid nodes
  const validEdges = map.edges.filter(
    (e) => !removedIds.has(e.sourceId) && !removedIds.has(e.targetId)
  );

  const lemmaGroups = new Map<string, ConceptNode[]>();
  for (const node of validNodes) {
    const lemma = normalizeLemma(node.label);
    const group = lemmaGroups.get(lemma) || [];
    group.push(node);
    lemmaGroups.set(lemma, group);
  }

  const mergeMap = new Map<string, string>();
  const removeIds = new Set<string>();

  for (const group of lemmaGroups.values()) {
    if (group.length <= 1) continue;
    // Keep the LONGEST label (original phrasing) instead of shortest (summarized)
    const sorted = [...group].sort((a, b) => b.label.length - a.label.length);
    const keep = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      mergeMap.set(sorted[i].id, keep.id);
      removeIds.add(sorted[i].id);
    }
  }

  if (removeIds.size === 0 && removedIds.size === 0) {
    return { ...map, nodes: validNodes, edges: validEdges };
  }

  const nodes = validNodes.filter((n) => !removeIds.has(n.id));
  const edges = validEdges
    .map((e) => ({
      ...e,
      sourceId: mergeMap.get(e.sourceId) || e.sourceId,
      targetId: mergeMap.get(e.targetId) || e.targetId,
    }))
    .filter((e) => e.sourceId !== e.targetId);

  const edgeKeys = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.sourceId}->${e.targetId}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  return { ...map, nodes, edges: uniqueEdges };
}
