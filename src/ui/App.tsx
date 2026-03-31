import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConceptMap, DensityLevel } from '../shared/types';
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
  const [hasSavedMap, setHasSavedMap] = useState(false);

  // Show settings if no API key configured
  useEffect(() => {
    if (loaded && !settings?.apiKey) {
      setScreen('settings');
    }
  }, [loaded, settings]);

  // Request saved map check on startup
  useEffect(() => {
    postToPlugin({ type: 'load-map' });
  }, []);

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

      if (msg.type === 'map-loaded') {
        setHasSavedMap(msg.payload !== null);
        // Store it so we can restore later
        if (msg.payload) {
          savedMapRef.current = msg.payload;
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Ref to hold the saved map data (avoids re-renders)
  const savedMapRef = useRef<ConceptMap | null>(null);
  const articleTextRef = useRef<string>('');

  // Save map to storage whenever extraction produces a new map
  useEffect(() => {
    if (extraction.map) {
      postToPlugin({ type: 'save-map', payload: extraction.map });
      setHasSavedMap(true);
      savedMapRef.current = extraction.map;
    }
  }, [extraction.map]);

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
    articleTextRef.current = text;
    extraction.extract({ text, focusQuery: focusQuery || undefined, density });
  };

  const handleRestoreMap = () => {
    if (savedMapRef.current) {
      extraction.updateMap(savedMapRef.current);
      extraction.updateSuggestions([]);
      setScreen('review');
    }
  };

  const handleGenerate = () => {
    if (!extraction.map) return;

    const { nodes, edges } = extraction.map;

    const result = computeLayout(nodes, edges, {
      type: 'hierarchical',
      nodeSpacing: 100,
      rankSpacing: 160,
    });

    setScreen('generating');
    postToPlugin({
      type: 'generate-map',
      payload: {
        nodes: result.nodes,
        edges,
        layout: 'hierarchical',
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
          savedMap={hasSavedMap}
          onRestoreMap={handleRestoreMap}
        />
      )}

      {screen === 'loading' && <LoadingScreen progress={extraction.progress} />}

      {screen === 'review' && extraction.map && (
        <ReviewPanel
          conceptMap={extraction.map}
          mergeSuggestions={extraction.suggestions}
          articleText={articleTextRef.current}
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

      <footer className="app-footer">by Rae J. of CCA MDes IxD, for the Systems Class of Hugh Dubberly</footer>
    </div>
  );
}
