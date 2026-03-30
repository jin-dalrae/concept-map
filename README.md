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

**ConceptMap** is a FigJam plugin that turns articles, research papers, and long-form text into structured concept maps — directly on your board. Powered by your own AI API key (Claude or Gemini).

## How It Works

```
Paste article → AI finds seed nouns → Sentences are matched → Relationships are extracted → Network expands → Generate on board
```

1. **Paste** your article text or fetch from a URL
2. **AI identifies** key seed nouns from a summary of the article
3. **Sentences are matched** — the plugin finds sentences containing each noun (no AI needed)
4. **Relationships are extracted** — AI reads those sentences and pulls out subject-verb-object triples
5. **Network expands** — newly discovered nouns become the next frontier, repeating steps 3-4 (breadth-first)
6. **Review** the extraction: edit labels, delete nodes, merge duplicates
7. **Generate** — text boxes + connectors appear on your FigJam board
8. **Rearrange** — switch layout and regenerate without re-extracting

Everything placed on the board is native FigJam elements. Move them, recolor them, add your own — it's your board.

## Extraction Pipeline

ConceptMap uses a **breadth-first, sentence-grounded** extraction approach:

1. **Seed extraction** — AI reads the article and returns 6-10 core noun phrases
2. **Sentence splitting** — the article is split into sentences (pure text processing, no AI)
3. **Sentence matching** — sentences containing each frontier concept are collected
4. **Relationship extraction** — AI reads the matched sentences and extracts subject-verb-object relationships plus any new nouns discovered
5. **BFS expansion** — new nouns become the next frontier; steps 3-4 repeat

**Density controls how deep the expansion goes:**

| Level | BFS Depth | Description |
|---|---|---|
| Core | 3 levels | Key ideas only |
| Standard | 5 levels | Balanced coverage |
| Deep | 10 levels | Thorough exploration |
| Full | 15 levels | Exhaustive — captures nearly everything |

## Features

| Feature | Description |
|---|---|
| **Breadth-first extraction** | Sentence-grounded concept discovery that expands outward from seed nouns |
| **Multi-provider AI** | Bring your own key — supports Claude (Anthropic) and Gemini (Google) |
| **4 density levels** | Control BFS expansion depth: 3, 5, 10, or 15 levels |
| **Focus query** | Bias extraction toward a specific topic, e.g. *"systemic barriers"* |
| **Smart dedup** | Auto-merge duplicates via lemmatization + AI canonicalization + string similarity |
| **Review panel** | Edit every node label, delete nodes/edges, accept or reject merge suggestions |
| **3 layout algorithms** | Radial (default), Hierarchical (top-down tree), Cluster (grouped by type) |
| **Rearrange after generation** | Switch layout and regenerate without running extraction again |
| **Citation tracking** | Every relationship carries the source sentence from the article |
| **Native FigJam elements** | Rounded text boxes + connectors — fully editable after generation |

## Getting Started

### Install as Development Plugin

1. Clone this repo and install dependencies:
   ```bash
   git clone https://github.com/jin-dalrae/concept-map.git
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
├── plugin/           # FigJam sandbox (creates text boxes, connectors, sections)
│   ├── controller.ts # Entry point, message handler
│   └── board.ts      # FigJam element creation
└── ui/               # React UI (runs in iframe)
    ├── api/          # LLM provider abstraction (Claude + Gemini)
    │   ├── prompts.ts # Seed extraction + relationship extraction prompts
    │   └── ...
    ├── components/   # Input, Review, Settings, Loading, Feedback screens
    ├── dedup/        # Duplicate detection pipeline
    ├── hooks/        # useExtraction (BFS pipeline), useSettings
    ├── layout/       # Radial, hierarchical, cluster algorithms
    ├── text/         # Sentence splitting + concept-sentence matching
    └── styles/       # CSS
```

### Architecture

The plugin uses FigJam's dual-thread model:

- **Plugin sandbox** (`dist/code.js`) — Has FigJam API access. Creates rounded text boxes, connectors, and sections. Persists settings via `figma.clientStorage`.
- **UI iframe** (`dist/index.html`) — React app. Handles all user interaction, AI API calls, BFS extraction, layout computation. Communicates with the sandbox via `postMessage`.

### Extraction Flow

```
                      ┌──────────────┐
                      │  Article Text │
                      └──────┬───────┘
                             │
                    ┌────────▼────────┐
                    │  AI: Seed Nouns  │  (6-10 core concepts)
                    └────────┬────────┘
                             │
                  ┌──────────▼──────────┐
               ┌──│   BFS Expansion     │──┐
               │  │   Loop (N levels)   │  │
               │  └─────────────────────┘  │
               │                           │
    ┌──────────▼──────────┐   ┌────────────▼───────────┐
    │ Match sentences to  │   │ AI: Extract relations   │
    │ frontier concepts   │──▶│ + discover new nouns    │
    │ (no AI needed)      │   │                         │
    └─────────────────────┘   └────────────┬───────────┘
                                           │
                              ┌─────────────▼────────────┐
                              │  New nouns → next frontier │
                              └──────────────────────────┘
```

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — Type safety across both threads
- **Vite** — UI bundler (single-file output for FigJam)
- **esbuild** — Plugin sandbox bundler (ES2015 target)
- **dagre** — Hierarchical graph layout
- **Custom algorithms** — Radial and cluster layouts

## License

MIT
