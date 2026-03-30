import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages';
import type { PluginSettings } from '../shared/types';
import { createMapOnBoard } from './board';

const STORAGE_KEY_SETTINGS = 'concept-map-settings';
const STORAGE_KEY_FEEDBACK = 'concept-map-feedback';

figma.showUI(__html__, {
  width: 420,
  height: 640,
  themeColors: true,
});

async function loadAndSendSettings() {
  const settings = (await figma.clientStorage.getAsync(STORAGE_KEY_SETTINGS)) as
    | PluginSettings
    | undefined;
  const msg: PluginToUIMessage = {
    type: 'settings-loaded',
    payload: settings ?? null,
  };
  figma.ui.postMessage(msg);
}

// Send settings on startup
loadAndSendSettings();

figma.ui.onmessage = async (msg: UIToPluginMessage) => {
  switch (msg.type) {
    case 'generate-map': {
      try {
        await createMapOnBoard(msg.payload);
        const reply: PluginToUIMessage = {
          type: 'map-generated',
          payload: {
            success: true,
            nodeCount: msg.payload.nodes.length,
            edgeCount: msg.payload.edges.length,
          },
        };
        figma.ui.postMessage(reply);
        figma.notify(
          `Map placed — ${msg.payload.nodes.length} concepts, ${msg.payload.edges.length} connections`
        );
      } catch (err) {
        const reply: PluginToUIMessage = {
          type: 'map-generated',
          payload: {
            success: false,
            nodeCount: 0,
            edgeCount: 0,
            error: String(err),
          },
        };
        figma.ui.postMessage(reply);
        figma.notify('Failed to generate map', { error: true });
      }
      break;
    }

    case 'get-settings': {
      await loadAndSendSettings();
      break;
    }

    case 'save-settings': {
      await figma.clientStorage.setAsync(STORAGE_KEY_SETTINGS, msg.payload);
      break;
    }

    case 'save-feedback': {
      const existing =
        ((await figma.clientStorage.getAsync(STORAGE_KEY_FEEDBACK)) as unknown[]) ?? [];
      existing.push({ ...msg.payload, timestamp: Date.now() });
      await figma.clientStorage.setAsync(STORAGE_KEY_FEEDBACK, existing);
      break;
    }

    case 'resize-ui': {
      figma.ui.resize(msg.payload.width, msg.payload.height);
      break;
    }
  }
};
