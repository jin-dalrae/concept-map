# Reading Concept Map Creator

<p align="center">
  <strong>Paste an article. Get a visual concept map. Edit it on your board.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FigJam-Plugin-ff7262?style=flat-square&logo=figma" />
  <img src="https://img.shields.io/badge/AI-Claude%20%7C%20Gemini-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
</p>

---

A FigJam plugin that turns articles, research papers, and long-form text into structured concept maps — directly on your board. Powered by your own AI API key (Claude or Gemini).

Made by Rae J. of CCA MDes IxD, for the Systems Class of Hugh Dubberly.

## How It Works

```
Paste article → AI finds seed nouns → Sentences are matched → Relationships are extracted → Network expands → Generate on board
```

1. **Paste** your article text
2. **AI identifies** key seed nouns from a summary of the article
3. **Sentences are matched** — finds sentences containing each noun using fuzzy stem matching (no AI needed)
4. **Relationships are extracted** — AI reads those sentences and pulls out subject-verb-object triples, preserving the document's own phrasing
5. **Network expands** — newly discovered nouns become the next frontier, repeating steps 3-4 (breadth-first)
6. **Review** the extraction: search, edit labels, delete nodes, merge duplicates
7. **Generate** — rounded text boxes + curved connectors appear on your FigJam board in a hierarchical top-down layout

Everything placed on the board is native FigJam elements. Move them, recolor them, add your own — it's your board.

## Extraction Pipeline

Uses a **breadth-first, sentence-grounded** extraction approach:

1. **Seed extraction** — AI reads the article and returns 6-10 core noun phrases
2. **Sentence splitting** — the article is split into sentences (pure text processing, no AI)
3. **Fuzzy sentence matching** — sentences containing each frontier concept are collected using stem-based matching ("economy" also matches "economic", "economically", etc.)
4. **Relationship extraction** — AI reads the matched sentences and extracts subject-verb-object relationships using the document's own phrasing (e.g. "is democratically elected", "proposed using", "sought to integrate") plus any new nouns discovered
5. **BFS expansion** — new nouns become the next frontier; steps 3-4 repeat

**Density controls how deep the expansion goes:**

| Level | BFS Depth | Description |
|---|---|---|
| Core | 3 levels | Key ideas only |
| Standard | 5 levels | Balanced coverage |
| Deep | 10 levels | Thorough exploration |
| Full | 15 levels | Exhaustive — captures nearly everything |

## Layout Algorithm

Uses **dagre** (directed acyclic graph) for hierarchical top-down layout:

- Nodes are sized dynamically based on label length (`max(160, label.length * 9 + 32)` pixels wide, 48px tall)
- Dagre receives the actual node dimensions so it can space them without overlap
- Rank separation: 160px between levels, node separation: 100px within a level
- Connectors use curved lines with arrow endpoints
- Everything is placed inside a FigJam section, auto-sized with padding

## Features

| Feature | Description |
|---|---|
| **Breadth-first extraction** | Sentence-grounded concept discovery that expands outward from seed nouns |
| **Natural edge labels** | Relationship labels use the document's own phrasing, not generic verbs |
| **Multi-provider AI** | Bring your own key — supports Claude (Anthropic) and Gemini (Google) |
| **4 density levels** | Control BFS expansion depth: 3, 5, 10, or 15 levels |
| **Focus query** | Bias extraction toward a specific topic, e.g. *"systemic barriers"* |
| **Fuzzy matching** | Stem-based sentence matching — "economy" catches "economic", "economically", etc. |
| **Smart dedup** | Auto-merge duplicates via lemmatization + AI canonicalization + string similarity |
| **Review panel** | Search/filter, edit labels, delete nodes/edges, accept or reject merge suggestions |
| **Hierarchical layout** | Top-down tree layout via dagre with dynamic node sizing |
| **Map persistence** | Last extraction is auto-saved; restore it when reopening the plugin |
| **Citation tracking** | Every relationship carries the source sentence from the article |
| **Native FigJam elements** | Rounded text boxes + curved connectors — fully editable after generation |

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

Uses a **Bring Your Own Key** model. Your key stays in FigJam's local storage and is never sent anywhere except directly to the AI provider.

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
    ├── layout/       # Hierarchical layout (dagre)
    ├── text/         # Sentence splitting + concept-sentence matching
    └── styles/       # CSS
```

### Architecture

The plugin uses FigJam's dual-thread model:

- **Plugin sandbox** (`dist/code.js`) — Has FigJam API access. Creates rounded text boxes, curved connectors, and sections. Persists settings via `figma.clientStorage`.
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
    │ (no AI needed)      │   │ (document's own phrasing)│
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
- **dagre** — Hierarchical directed graph layout

## License

MIT
