import { useState } from 'react';
import type { DensityLevel } from '../../shared/types';
import { DENSITY_LABELS, DENSITY_DESCRIPTIONS } from '../../shared/constants';

interface Props {
  defaultDensity: DensityLevel;
  onSubmit: (text: string, focusQuery: string, density: DensityLevel) => void;
  onOpenSettings: () => void;
}

const DENSITY_OPTIONS: DensityLevel[] = ['sparse', 'standard', 'dense', 'exhaustive'];

export function InputScreen({ defaultDensity, onSubmit, onOpenSettings }: Props) {
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [focusQuery, setFocusQuery] = useState('');
  const [density, setDensity] = useState<DensityLevel>(defaultDensity);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const handleUrlFetch = async () => {
    if (!url) return;
    setFetching(true);
    setFetchError('');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, nav, footer, header, aside, [role="navigation"]').forEach((el) => el.remove());
      const articleText = (doc.body?.innerText || '').trim();
      if (!articleText) throw new Error('No text content found');
      setText(articleText);
      setInputMode('text');
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : 'Failed to fetch URL. Try pasting the text directly.'
      );
    }
    setFetching(false);
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim(), focusQuery.trim(), density);
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="panel input-screen">
      <div className="panel-header">
        <h2>ConceptMap</h2>
        <button className="btn-icon" onClick={onOpenSettings} title="Settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z" />
          </svg>
        </button>
      </div>

      <div className="tab-group">
        <button
          className={`tab ${inputMode === 'text' ? 'active' : ''}`}
          onClick={() => setInputMode('text')}
        >
          Paste Text
        </button>
        <button
          className={`tab ${inputMode === 'url' ? 'active' : ''}`}
          onClick={() => setInputMode('url')}
        >
          URL
        </button>
      </div>

      {inputMode === 'text' ? (
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your article text here..."
          rows={10}
        />
      ) : (
        <div className="url-input-group">
          <input
            type="url"
            className="input"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFetchError('');
            }}
            placeholder="https://example.com/article"
          />
          <button
            className="btn-secondary"
            onClick={handleUrlFetch}
            disabled={!url || fetching}
          >
            {fetching ? 'Fetching...' : 'Fetch'}
          </button>
          {fetchError && <span className="hint error">{fetchError}</span>}
        </div>
      )}

      {text && (
        <div className="hint">{wordCount} words</div>
      )}

      <div className="form-group">
        <label>Focus Query <span className="optional">(optional)</span></label>
        <input
          type="text"
          className="input"
          value={focusQuery}
          onChange={(e) => setFocusQuery(e.target.value)}
          placeholder='e.g. "urban youth" or "systemic barriers"'
        />
      </div>

      <div className="form-group">
        <label>Density</label>
        <div className="toggle-group">
          {DENSITY_OPTIONS.map((d) => (
            <button
              key={d}
              className={`toggle-btn ${density === d ? 'active' : ''}`}
              onClick={() => setDensity(d)}
            >
              <span className="toggle-label">{DENSITY_LABELS[d]}</span>
              <span className="toggle-sub">{DENSITY_DESCRIPTIONS[d]}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={!text.trim()}
      >
        Extract Concepts
      </button>
    </div>
  );
}
