# ConceptMap — AI-Powered Concept Maps for FigJam

<p align="center">
  <strong>Paste an article. Get a visual concept map. Edit it on your board.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FigJam-Plugin-ff7262?style=flat-square&logo=figma" />
  <img src="https://img.shields.io/badge/AI-Claude%20%7C%20Gemini-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
</p>

---

**ConceptMap** is a FigJam plugin that turns articles, research papers, and long-form text into structured, color-coded concept maps — directly on your board. Powered by your own AI API key (Claude or Gemini).

## How It Works

```
Paste article → AI extracts concepts → Review & edit → Generate on board
```

1. **Paste** your article text or fetch from a URL
2. **AI extracts** key concepts, actors, processes, and outcomes — plus their relationships
3. **Review** the extraction: edit labels, delete nodes, merge duplicates
4. **Generate** — sticky notes + connectors appear on your FigJam board, ready to rearrange

Everything placed on the board is native FigJam elements. Move them, recolor them, add your own — it's your board.

## Features

| Feature | Description |
|---|---|
| **Multi-provider AI** | Bring your own key — supports Claude (Anthropic) and Gemini (Google) |
| **4 density levels** | Sparse (5-8), Standard (10-16), Dense (20-30), or All (35-60 nodes) |
| **Focus query** | Bias extraction toward a specific topic, e.g. *"systemic barriers"* |
| **Smart dedup** | 3-stage duplicate detection: lemmatization, AI canonicalization, string similarity |
| **Review panel** | Edit every node label, delete nodes/edges, accept or reject merge suggestions |
| **3 layout algorithms** | Radial (default), Hierarchical (top-down tree), Cluster (grouped by type) |
| **Color-coded types** | Yellow = concept, Purple = actor, Blue = process, Green = outcome |
| **Citation tracking** | Every node carries a source quote from the original text |
| **Native FigJam elements** | Sticky notes + connectors — fully editable after generation |

## Getting Started

### Install as Development Plugin

1. Clone this repo and install dependencies:
   ```bash
   git clone <repo-url>
   cd concept-map
   npm install
   npm run build
   ```

2. Open **FigJam** → Plugins → Development → **Import plugin from manifest**

3. Select the `manifest.json` from this project

4. Run the plugin — it will prompt you for your API key on first launch

### API Key Setup

ConceptMap uses a **Bring Your Own Key** model. Your key stays in FigJam's local storage and is never sent anywhere except directly to the AI provider.

- **Claude**: Get a key at [console.anthropic.com](https://console.anthropic.com/)
- **Gemini**: Get a key at [aistudio.google.com](https://aistudio.google.com/)

## Development

```bash
# Install dependencies
npm install

# Start dev server (hot-reload UI + watch plugin code)
npm run dev

# Production build
npm run build

# Type check
npm run typecheck
```

### Project Structure

```
src/
├── shared/           # Types, constants shared between plugin + UI
├── plugin/           # FigJam sandbox (creates stickies, connectors, sections)
│   ├── controller.ts # Entry point, message handler
│   └── board.ts      # FigJam element creation
└── ui/               # React UI (runs in iframe)
    ├── api/          # LLM provider abstraction (Claude + Gemini)
    ├── components/   # Input, Review, Settings, Loading, Feedback screens
    ├── dedup/        # 3-stage duplicate detection pipeline
    ├── hooks/        # useExtraction, useSettings
    ├── layout/       # Radial, hierarchical, cluster algorithms
    └── styles/       # CSS
```

### Architecture

The plugin uses FigJam's dual-thread model:

- **Plugin sandbox** (`dist/code.js`) — Has FigJam API access. Creates sticky notes, connectors, and sections. Persists settings via `figma.clientStorage`.
- **UI iframe** (`dist/index.html`) — React app. Handles all user interaction, AI API calls, layout computation. Communicates with the sandbox via `postMessage`.

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — Type safety across both threads
- **Vite** — UI bundler (single-file output for FigJam)
- **esbuild** — Plugin sandbox bundler
- **dagre** — Hierarchical graph layout
- **Custom algorithms** — Radial and cluster layouts

## License

MIT
