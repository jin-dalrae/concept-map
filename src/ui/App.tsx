import { useState, useEffect, useCallback } from 'react';
import type { LayoutType, DensityLevel } from '../shared/types';
import type { PluginToUIMessage, UIToPluginMessage } from '../shared/messages';
import { useSettings } from './hooks/useSettings';
import { useExtraction } from './hooks/useExtraction';
import { computeLayout } from './layout';
import { InputScreen } from './components/InputScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { ReviewPanel } from './components/ReviewPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { FeedbackModal } from './components/FeedbackModal';

type Screen = 'input' | 'loading' | 'review' | 'generating' | 'feedback' | 'settings';

export function App() {
  const { settings, loaded, saveSettings } = useSettings();
  const extraction = useExtraction(settings);
  const [screen, setScreen] = useState<Screen>('input');
  const [genResult, setGenResult] = useState<{ nodeCount: number; edgeCount: number }>({
    nodeCount: 0,
    edgeCount: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Show settings if no API key configured
  useEffect(() => {
    if (loaded && !settings?.apiKey) {
      setScreen('settings');
    }
  }, [loaded, settings]);

  // Listen for plugin responses
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginToUIMessage | undefined;
      if (!msg) return;

      if (msg.type === 'map-generated') {
        if (msg.payload.success) {
          setGenResult({
            nodeCount: msg.payload.nodeCount,
            edgeCount: msg.payload.edgeCount,
          });
          setScreen('feedback');
        } else {
          setError(msg.payload.error ?? 'Failed to generate map');
          setScreen('review');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Watch extraction state
  useEffect(() => {
    if (extraction.loading) {
      setScreen('loading');
    } else if (extraction.map) {
      setScreen('review');
    } else if (extraction.error) {
      setError(extraction.error);
      setScreen('input');
    }
  }, [extraction.loading, extraction.map, extraction.error]);

  const postToPlugin = useCallback((msg: UIToPluginMessage) => {
    parent.postMessage({ pluginMessage: msg }, '*');
  }, []);

  const handleExtract = (text: string, focusQuery: string, density: DensityLevel) => {
    setError(null);
    extraction.extract({ text, focusQuery: focusQuery || undefined, density });
  };

  const handleGenerate = (layout: LayoutType) => {
    if (!extraction.map) return;

    // Apply accepted merges are already handled in ReviewPanel
    const { nodes, edges } = extraction.map;

    // Compute layout coordinates
    const result = computeLayout(nodes, edges, {
      type: layout,
      nodeSpacing: 100,
      rankSpacing: 160,
    });

    setScreen('generating');
    postToPlugin({
      type: 'generate-map',
      payload: {
        nodes: result.nodes,
        edges,
        layout,
        title: extraction.map.title,
      },
    });
  };

  const handleFeedbackSubmit = (feedback: {
    useful: boolean;
    issues: string[];
    comment?: string;
  }) => {
    postToPlugin({ type: 'save-feedback', payload: feedback });
    setScreen('input');
  };

  if (!loaded) {
    return <LoadingScreen progress="Loading..." />;
  }

  return (
    <div className="app">
      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button className="btn-icon" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      {screen === 'settings' && (
        <SettingsPanel
          settings={settings}
          onSave={saveSettings}
          onBack={() => setScreen('input')}
        />
      )}

      {screen === 'input' && (
        <InputScreen
          defaultDensity={settings?.density ?? 'dense'}
          onSubmit={handleExtract}
          onOpenSettings={() => setScreen('settings')}
        />
      )}

      {screen === 'loading' && <LoadingScreen progress={extraction.progress} />}

      {screen === 'review' && extraction.map && (
        <ReviewPanel
          conceptMap={extraction.map}
          mergeSuggestions={extraction.suggestions}
          defaultLayout={settings?.layout ?? 'radial'}
          onUpdateMap={extraction.updateMap}
          onUpdateSuggestions={extraction.updateSuggestions}
          onGenerate={handleGenerate}
          onBack={() => {
            extraction.updateMap(null as any);
            setScreen('input');
          }}
        />
      )}

      {screen === 'generating' && <LoadingScreen progress="Generating on board..." />}

      {screen === 'feedback' && (
        <FeedbackModal
          nodeCount={genResult.nodeCount}
          edgeCount={genResult.edgeCount}
          onSubmit={handleFeedbackSubmit}
          onDismiss={() => setScreen('input')}
          onRearrange={() => setScreen('review')}
        />
      )}
    </div>
  );
}
