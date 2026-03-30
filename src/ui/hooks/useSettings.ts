import { useState, useEffect, useCallback } from 'react';
import type { PluginSettings } from '../../shared/types';
import type { UIToPluginMessage, PluginToUIMessage } from '../../shared/messages';

export function useSettings() {
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginToUIMessage | undefined;
      if (msg?.type === 'settings-loaded') {
        setSettings(msg.payload);
        setLoaded(true);
      }
    };
    window.addEventListener('message', handler);

    // Request settings from plugin on mount
    postToPlugin({ type: 'get-settings' });

    // Fallback: if running outside FigJam (standalone browser), mark as loaded
    // after a short timeout so the UI is still usable for testing
    const timeout = setTimeout(() => {
      setLoaded((prev) => {
        if (!prev) return true;
        return prev;
      });
    }, 1500);

    return () => {
      window.removeEventListener('message', handler);
      clearTimeout(timeout);
    };
  }, []);

  const saveSettings = useCallback((newSettings: PluginSettings) => {
    setSettings(newSettings);
    postToPlugin({ type: 'save-settings', payload: newSettings });
  }, []);

  return { settings, loaded, saveSettings };
}

function postToPlugin(msg: UIToPluginMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}
