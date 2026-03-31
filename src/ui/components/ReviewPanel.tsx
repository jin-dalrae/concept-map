import { useState, useMemo } from 'react';
import type {
  ConceptMap,
  ConceptNode,
  MergeSuggestion,
} from '../../shared/types';
import { splitSentences } from '../text/sentences';

interface Props {
  conceptMap: ConceptMap;
  mergeSuggestions: MergeSuggestion[];
  articleText: string;
  onUpdateMap: (map: ConceptMap) => void;
  onUpdateSuggestions: (suggestions: MergeSuggestion[]) => void;
  onGenerate: () => void;
  onBack: () => void;
  onExpand?: () => void;
  isExpanding?: boolean;
}

const LOW_COVERAGE_THRESHOLD = 50;

export function ReviewPanel({
  conceptMap,
  mergeSuggestions,
  articleText,
  onUpdateMap,
  onUpdateSuggestions,
  onGenerate,
  onBack,
  onExpand,
  isExpanding,
}: Props) {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [search, setSearch] = useState('');

  const pendingSuggestions = mergeSuggestions.filter((s) => s.accepted === null);

  // Filter nodes and edges by search query
  const searchLower = search.toLowerCase().trim();

  const filteredNodes = useMemo(() => {
    if (!searchLower) return conceptMap.nodes;
    return conceptMap.nodes.filter((n) =>
      n.label.toLowerCase().includes(searchLower)
    );
  }, [conceptMap.nodes, searchLower]);

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  const filteredEdges = useMemo(() => {
    if (!searchLower) return conceptMap.edges;
    return conceptMap.edges.filter(
      (e) =>
        filteredNodeIds.has(e.sourceId) ||
        filteredNodeIds.has(e.targetId) ||
        e.label.toLowerCase().includes(searchLower)
    );
  }, [conceptMap.edges, searchLower, filteredNodeIds]);

  // --- Quality metrics ---
  const metrics = useMemo(() => {
    if (!articleText) return null;

    const articleLower = articleText.toLowerCase();
    const sentences = splitSentences(articleText);

    // Coverage: how many article sentences are referenced by at least one sourceQuote
    const allQuotes = [
      ...conceptMap.nodes.map((n) => n.sourceQuote).filter(Boolean),
      ...conceptMap.edges.map((e) => e.sourceQuote).filter(Boolean),
    ];
    const coveredSentences = sentences.filter((sent) => {
      const sentLower = sent.toLowerCase();
      return allQuotes.some((q) => {
        const qLower = q.toLowerCase();
        // Check if the quote appears in this sentence or vice versa
        return sentLower.includes(qLower) || qLower.includes(sentLower);
      });
    });

    // Faithfulness: how many sourceQuotes actually appear in the article text
    const uniqueQuotes = [...new Set(allQuotes)];
    const verifiedQuotes = uniqueQuotes.filter((q) =>
      articleLower.includes(q.toLowerCase())
    );

    return {
      sentencesCovered: coveredSentences.length,
      sentencesTotal: sentences.length,
      coveragePct: sentences.length > 0
        ? Math.round((coveredSentences.length / sentences.length) * 100)
        : 0,
      quotesVerified: verifiedQuotes.length,
      quotesTotal: uniqueQuotes.length,
      faithfulnessPct: uniqueQuotes.length > 0
        ? Math.round((verifiedQuotes.length / uniqueQuotes.length) * 100)
        : 0,
    };
  }, [articleText, conceptMap.nodes, conceptMap.edges]);

  // --- Node editing ---
  const startEdit = (node: ConceptNode) => {
    setEditingNodeId(node.id);
    setEditLabel(node.label);
  };

  const saveEdit = () => {
    if (!editingNodeId) return;
    onUpdateMap({
      ...conceptMap,
      nodes: conceptMap.nodes.map((n) =>
        n.id === editingNodeId ? { ...n, label: editLabel } : n
      ),
    });
    setEditingNodeId(null);
  };

  const deleteNode = (nodeId: string) => {
    onUpdateMap({
      ...conceptMap,
      nodes: conceptMap.nodes.filter((n) => n.id !== nodeId),
      edges: conceptMap.edges.filter(
        (e) => e.sourceId !== nodeId && e.targetId !== nodeId
      ),
    });
  };

  const deleteEdge = (edgeId: string) => {
    onUpdateMap({
      ...conceptMap,
      edges: conceptMap.edges.filter((e) => e.id !== edgeId),
    });
  };

  // --- Merge handling ---
  const handleMerge = (index: number, accept: boolean) => {
    const updated = [...mergeSuggestions];
    updated[index] = { ...updated[index], accepted: accept };
    onUpdateSuggestions(updated);

    if (accept) {
      const suggestion = updated[index];
      // Keep the first node, remove others, redirect edges
      const keepId = suggestion.nodeIds[0];
      const removeIds = suggestion.nodeIds.slice(1);

      const newNodes = conceptMap.nodes
        .filter((n) => !removeIds.includes(n.id))
        .map((n) => (n.id === keepId ? { ...n, label: suggestion.canonicalLabel } : n));

      const newEdges = conceptMap.edges
        .map((e) => ({
          ...e,
          sourceId: removeIds.includes(e.sourceId) ? keepId : e.sourceId,
          targetId: removeIds.includes(e.targetId) ? keepId : e.targetId,
        }))
        // Remove self-referential edges created by merge
        .filter((e) => e.sourceId !== e.targetId);

      onUpdateMap({ ...conceptMap, nodes: newNodes, edges: newEdges });
    }
  };

  const getNodeLabel = (id: string) =>
    conceptMap.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div className="panel review-panel">
      <div className="panel-header">
        <button className="btn-icon" onClick={onBack} title="Back">
          &larr;
        </button>
        <h2>Review Map</h2>
        <span className="badge">
          {conceptMap.nodes.length} nodes &middot; {conceptMap.edges.length} edges
        </span>
      </div>

      {conceptMap.summary && (
        <p className="summary">{conceptMap.summary}</p>
      )}

      {/* Quality metrics */}
      {metrics && (
        <div className="metrics-bar">
          <div className="metric">
            <span className="metric-label">Coverage</span>
            <span className="metric-value">{metrics.coveragePct}%</span>
            <span className="metric-detail">
              {metrics.sentencesCovered}/{metrics.sentencesTotal} sentences
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Faithfulness</span>
            <span className="metric-value">{metrics.faithfulnessPct}%</span>
            <span className="metric-detail">
              {metrics.quotesVerified}/{metrics.quotesTotal} quotes verified
            </span>
          </div>
        </div>
      )}

      {/* Merge suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="section">
          <h3>Possible Duplicates</h3>
          {mergeSuggestions.map((s, i) =>
            s.accepted === null ? (
              <div key={i} className="merge-card">
                <div className="merge-labels">
                  {s.nodeIds.map((id) => (
                    <span key={id} className="merge-tag">
                      {getNodeLabel(id)}
                    </span>
                  ))}
                </div>
                <div className="merge-reason">{s.reason}</div>
                <div className="merge-actions">
                  <button
                    className="btn-sm btn-merge"
                    onClick={() => handleMerge(i, true)}
                  >
                    Merge as "{s.canonicalLabel}"
                  </button>
                  <button
                    className="btn-sm btn-dismiss"
                    onClick={() => handleMerge(i, false)}
                  >
                    Keep separate
                  </button>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Search filter — only show when there are 10+ nodes */}
      {conceptMap.nodes.length >= 10 && (
        <input
          className="input input-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter concepts..."
        />
      )}

      {/* Nodes */}
      <div className="section">
        <h3>
          Concepts
          {searchLower && (
            <span className="filter-count">
              {' '}({filteredNodes.length} of {conceptMap.nodes.length})
            </span>
          )}
        </h3>
        <div className="node-list">
          {filteredNodes.map((node) => (
            <div key={node.id} className="node-item">
              {editingNodeId === node.id ? (
                <div className="node-edit-row">
                  <input
                    className="input input-sm"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                  />
                  <button className="btn-icon" onClick={saveEdit}>
                    &#10003;
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => setEditingNodeId(null)}
                  >
                    &#10005;
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="node-label"
                    onClick={() => startEdit(node)}
                    title={node.description}
                  >
                    {node.label}
                  </span>
                  <button
                    className="btn-icon btn-delete"
                    onClick={() => deleteNode(node.id)}
                    title="Delete"
                  >
                    &times;
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Edges */}
      <div className="section">
        <h3>
          Connections
          {searchLower && (
            <span className="filter-count">
              {' '}({filteredEdges.length} of {conceptMap.edges.length})
            </span>
          )}
        </h3>
        <div className="edge-list">
          {filteredEdges.map((edge) => (
            <div key={edge.id} className="edge-item">
              <span className="edge-from">{getNodeLabel(edge.sourceId)}</span>
              <span className="edge-label">{edge.label}</span>
              <span className="edge-to">{getNodeLabel(edge.targetId)}</span>
              <button
                className="btn-icon btn-delete"
                onClick={() => deleteEdge(edge.id)}
                title="Delete"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={() => onGenerate()}>
        Generate Map
      </button>
    </div>
  );
}
