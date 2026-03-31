# CLAUDE.md

## Project Overview

Reading Concept Map Creator - A FigJam plugin that extracts concept maps from articles using LLM-powered analysis. Built with React, TypeScript, and Vite.

## Build & Run

```bash
npm install    # Install dependencies
npm run dev    # Development mode with hot reload
npm run build  # Production build
```

## Project Structure

- `src/plugin/` - FigJam plugin code (runs in Figma sandbox)
- `src/ui/` - React UI (runs in iframe)
- `src/shared/` - Shared types and constants

## Key Files

- `src/ui/hooks/useExtraction.ts` - BFS concept extraction logic
- `src/ui/api/prompts.ts` - LLM prompts for extraction
- `src/ui/components/ReviewPanel.tsx` - Map review and editing UI
- `src/plugin/board.ts` - FigJam board generation

## Code Style

- TypeScript strict mode
- Functional React components with hooks
- No class components

## Response Guidelines

- Answer directly on line 1
- No sycophantic openers or hollow closings
- Execute immediately without restating the prompt
- No unnecessary disclaimers
- Stay within requested scope only
- Use simplest working approach
- Say "I don't know" when uncertain
- Never read the same file twice in a session
- Do not touch unrequested code
