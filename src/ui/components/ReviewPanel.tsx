import { useState } from 'react';
import type {
  ConceptMap,
  ConceptNode,
  ConceptEdge,
  MergeSuggestion,
  LayoutType,
} from '../../shared/types';

interface Props {
  conceptMap: ConceptMap;
  mergeSuggestions: MergeSuggestion[];
  defaultLayout: LayoutType;
  onUpdateMap: (map: ConceptMap) => void;
  onUpdateSuggestions: (suggestions: MergeSuggestion[]) => void;
  onGenerate: (layout: LayoutType) => void;
  onBack: () => void;
}

export function ReviewPanel({
  conceptMap,
  mergeSuggestions,
  defaultLayout,
  onUpdateMap,
  onUpdateSuggestions,
  onGenerate,
  onBack,
}: Props) {
  const [layout, setLayout] = useState<LayoutType>(defaultLayout);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const pendingSuggestions = mergeSuggestions.filter((s) => s.accepted === null);

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

      {/* Nodes */}
      <div className="section">
        <h3>Concepts</h3>
        <div className="node-list">
          {conceptMap.nodes.map((node) => (
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
        <h3>Connections</h3>
        <div className="edge-list">
          {conceptMap.edges.map((edge) => (
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

      {/* Layout picker */}
      <div className="form-group">
        <label>Layout</label>
        <div className="toggle-group">
          {(['radial', 'hierarchical', 'cluster'] as LayoutType[]).map((l) => (
            <button
              key={l}
              className={`toggle-btn ${layout === l ? 'active' : ''}`}
              onClick={() => setLayout(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={() => onGenerate(layout)}>
        Generate Map
      </button>
    </div>
  );
}
