import { useState } from 'react';
import type { PluginSettings, LLMProvider, DensityLevel, LayoutType } from '../../shared/types';
import { MODEL_OPTIONS, DENSITY_LABELS } from '../../shared/constants';

interface Props {
  settings: PluginSettings | null;
  onSave: (settings: PluginSettings) => void;
  onBack: () => void;
}

const DENSITY_OPTIONS: DensityLevel[] = ['sparse', 'standard', 'dense', 'exhaustive'];

export function SettingsPanel({ settings, onSave, onBack }: Props) {
  const [provider, setProvider] = useState<LLMProvider>(settings?.provider || 'gemini');
  const [apiKey, setApiKey] = useState(settings?.apiKey || '');
  const [model, setModel] = useState(settings?.model || MODEL_OPTIONS.gemini[0].value);
  const [density, setDensity] = useState<DensityLevel>(settings?.density || 'standard');
  const [layout, setLayout] = useState<LayoutType>(settings?.layout || 'radial');
  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p);
    setModel(MODEL_OPTIONS[p][0].value);
    setValid(null);
  };

  const handleValidate = async () => {
    setValidating(true);
    setValid(null);
    try {
      const { createLLMClient } = await import('../api/provider');
      const client = createLLMClient(provider, { apiKey, model });
      const isValid = await client.validateKey();
      setValid(isValid);
    } catch {
      setValid(false);
    }
    setValidating(false);
  };

  const handleSave = () => {
    onSave({ provider, apiKey, model, density, layout });
    onBack();
  };

  return (
    <div className="panel settings-panel">
      <div className="panel-header">
        <button className="btn-icon" onClick={onBack} title="Back">
          &larr;
        </button>
        <h2>Settings</h2>
      </div>

      <div className="form-group">
        <label>AI Provider</label>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${provider === 'claude' ? 'active' : ''}`}
            onClick={() => handleProviderChange('claude')}
          >
            Claude
          </button>
          <button
            className={`toggle-btn ${provider === 'gemini' ? 'active' : ''}`}
            onClick={() => handleProviderChange('gemini')}
          >
            Gemini
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>API Key</label>
        <div className="input-row">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setValid(null);
            }}
            placeholder={provider === 'claude' ? 'sk-ant-...' : 'AIza...'}
            className="input"
          />
          <button
            className="btn-secondary btn-sm"
            onClick={handleValidate}
            disabled={!apiKey || validating}
          >
            {validating ? '...' : 'Test'}
          </button>
        </div>
        {valid === true && <span className="hint success">Key is valid</span>}
        {valid === false && <span className="hint error">Key is invalid</span>}
      </div>

      <div className="form-group">
        <label>Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="select"
        >
          {MODEL_OPTIONS[provider].map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Default Density</label>
        <div className="toggle-group">
          {DENSITY_OPTIONS.map((d) => (
            <button
              key={d}
              className={`toggle-btn ${density === d ? 'active' : ''}`}
              onClick={() => setDensity(d)}
            >
              {DENSITY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Default Layout</label>
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

      <button className="btn-primary" onClick={handleSave} disabled={!apiKey}>
        Save Settings
      </button>
    </div>
  );
}
