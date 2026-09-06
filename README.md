# Curriculum Creation Engine

A single-page tool for building a nursing-school curriculum — either by hand, Notion-style inline editing, or by uploading a PDF and letting Claude structure it automatically. Built for Lingocare's Full Stack Developer Intern technical task.

**Live demo:** [curriculum-creation-engine.vercel.app](https://curriculum-creation-engine.vercel.app)

## What it does

- **Manual creation** — click to add a Module, Topic, or Lesson; click any title or description to edit it inline; delete anything with instant undo (toast + `Ctrl+Z`).
- **AI import** — upload a PDF, and Claude reads it natively (as rendered pages, not extracted text) to identify Modules and Topics, then a second pass fills in Lessons for each Topic. Missing structure is inferred and honestly labeled as such, never presented as if it came from the document.
- Both paths land in the exact same editable tree — there's no difference between a manually created node and an AI-generated one once it's on the page.

## Tech stack

Next.js (App Router) · React · Tailwind CSS · `@anthropic-ai/sdk` (Claude Opus 5 for structural extraction, Claude Sonnet 5 for lesson generation) · Zod for structured AI output validation.

## Running locally

```bash
npm install
```

Create `.env.local` in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Design reasoning

The full design doc — the flat-state-vs-nested-tree decision, the two-pass AI architecture, prompt design, and where the spec was deliberately pushed back on — lives in [`CLAUDE.md`](./CLAUDE.md). It's the single source of truth this project was built against, phase by phase, and it's the closest thing to a written version of the walkthrough video.
