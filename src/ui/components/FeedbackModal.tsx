import { useState } from 'react';

interface Props {
  nodeCount: number;
  edgeCount: number;
  onSubmit: (feedback: { useful: boolean; issues: string[]; comment?: string }) => void;
  onDismiss: () => void;
}

const ISSUE_OPTIONS = [
  'Too many nodes / too noisy',
  'Missed key ideas',
  'Wrong or invented connections',
  'Labels don\'t make sense',
];

export function FeedbackModal({ nodeCount, edgeCount, onSubmit, onDismiss }: Props) {
  const [useful, setUseful] = useState<boolean | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const toggleIssue = (issue: string) => {
    setIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  };

  const handleSubmit = () => {
    if (useful === null) return;
    onSubmit({ useful, issues });
  };

  return (
    <div className="panel feedback-modal">
      <div className="panel-header">
        <h2>Map Generated</h2>
        <button className="btn-icon" onClick={onDismiss}>
          &times;
        </button>
      </div>

      <p className="success-text">
        Placed {nodeCount} concepts and {edgeCount} connections on your board.
      </p>

      <div className="form-group">
        <label>Was this map useful?</label>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${useful === true ? 'active' : ''}`}
            onClick={() => setUseful(true)}
          >
            Yes
          </button>
          <button
            className={`toggle-btn ${useful === false ? 'active' : ''}`}
            onClick={() => setUseful(false)}
          >
            No
          </button>
        </div>
      </div>

      {useful === false && (
        <div className="form-group">
          <label>What went wrong?</label>
          <div className="checkbox-group">
            {ISSUE_OPTIONS.map((issue) => (
              <label key={issue} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={issues.includes(issue)}
                  onChange={() => toggleIssue(issue)}
                />
                {issue}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="button-row">
        <button className="btn-secondary" onClick={onDismiss}>
          Dismiss
        </button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={useful === null}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
