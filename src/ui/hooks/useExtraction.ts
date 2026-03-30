import { useState, useCallback } from 'react';
import type {
  ConceptMap,
  MergeSuggestion,
  ExtractionRequest,
  PluginSettings,
} from '../../shared/types';
import { createLLMClient } from '../api/provider';
import { runDedupPipeline } from '../dedup/pipeline';

interface ExtractionState {
  loading: boolean;
  progress: string;
  map: ConceptMap | null;
  suggestions: MergeSuggestion[];
  error: string | null;
}

export function useExtraction(settings: PluginSettings | null) {
  const [state, setState] = useState<ExtractionState>({
    loading: false,
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
        progress: 'Extracting concepts...',
        map: null,
        suggestions: [],
        error: null,
      });

      try {
        const client = createLLMClient(settings.provider, {
          apiKey: settings.apiKey,
          model: settings.model,
        });

        // Step 1: LLM extraction
        const result = await client.extractConceptMap(request);

        setState((s) => ({ ...s, progress: 'Checking for duplicates...' }));

        // Step 2: Dedup pipeline
        let suggestions: MergeSuggestion[] = [];
        try {
          suggestions = await runDedupPipeline(result.map.nodes, client);
        } catch (err) {
          console.warn('Dedup pipeline failed, continuing without:', err);
        }

        setState({
          loading: false,
          progress: '',
          map: result.map,
          suggestions,
          error: null,
        });
      } catch (err) {
        setState({
          loading: false,
          progress: '',
          map: null,
          suggestions: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [settings]
  );

  const updateMap = useCallback((map: ConceptMap) => {
    setState((s) => ({ ...s, map }));
  }, []);

  const updateSuggestions = useCallback((suggestions: MergeSuggestion[]) => {
    setState((s) => ({ ...s, suggestions }));
  }, []);

  return { ...state, extract, updateMap, updateSuggestions };
}
