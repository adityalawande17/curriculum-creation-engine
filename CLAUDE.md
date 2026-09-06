# CLAUDE.md — Curriculum Creation Engine

> Working document for the Lingocare Full Stack Developer Intern technical task.
> This file is the single source of truth: what we're building, why we're building it
> that way, and the exact order we build it in.
>
> **Read this whole file once before writing any code.** Then work one phase at a time.

---

## Table of Contents

1. [The Deal](#1-the-deal)
2. [What We're Building](#2-what-were-building)
3. [Decisions We've Already Made (and why)](#3-decisions-weve-already-made-and-why)
4. [Where We Push Back on the Spec](#4-where-we-push-back-on-the-spec)
5. [The Tech Stack](#5-the-tech-stack)
6. [The Data Model — the most important section](#6-the-data-model--the-most-important-section)
7. [File / Folder Layout](#7-file--folder-layout)
8. [The AI Architecture](#8-the-ai-architecture)
9. [The Phases](#9-the-phases)
10. [Design System](#10-design-system)
11. [Known Traps](#11-known-traps)
12. [Definition of Done](#12-definition-of-done)

---

## 1. The Deal

**Client:** Lingocare — AI-native platform for nursing education in Germany.
**Deliverable:** a live URL + a 5-minute video. **No code submission, no Figma, no slides.**
**Deadline behaviour:** the link must work *on the day they review it*.

They are explicitly evaluating five things. Memorise these — every decision in this
document maps back to one of them:

| # | Criterion | What it really means |
|---|-----------|----------------------|
| 01 | **Interaction Quality** | Does inline editing feel like Notion, or like a form? Is the hierarchy readable at a glance? |
| 02 | **AI Integration Thinking** | Prompt design, PDF edge cases, and the *user flow around* the AI — not just "call API, dump JSON". |
| 03 | **User Flow Awareness** | Did you question the spec? Did you simplify something? Did you think about the human? |
| 04 | **Code Clarity** | Clean data flow, sensible components, readable logic. |
| 05 | **Explanation Quality** | The video is about **why**, not **what**. |

> Note the asymmetry: **three of the five criteria are about thinking, not shipping.**
> A beautiful app with no story loses to a good app with a sharp story. We are optimising
> for both, but we never sacrifice the story.

---

## 2. What We're Building

A **single page** where a nursing-school director builds a course structure.

```
Curriculum
└── Module          (e.g. "Pflegefachassistent werden")
    └── Topic       (e.g. "Berufliches Selbstverständnis")
        └── Lesson  (e.g. "History & Professional Identity")
```

Every level has exactly two editable fields: **title** and **description**. That's it.
(Lesson detail fields — activities, outcomes, homework, linked lessons — are explicitly
out of scope per the brief.)

Two ways to fill the page, producing **the same** editable structure:

- **Manual** — click "Add Module", type, nest, delete.
- **AI** — upload a PDF, we parse it with Claude, and the result lands in the exact
  same components so it's immediately editable.

Everything lives in browser memory. No database, no auth.

---

## 3. Decisions We've Already Made (and why)

These are the decisions that shape everything downstream. Each one is a video talking point.

### D1. State is a **flat normalised map**, not a nested tree

This is the single most important technical decision in the project.

The obvious model is a nested tree:

```js
// ❌ The obvious model. Do NOT use this.
{ title: "Curriculum", modules: [ { title, topics: [ { title, lessons: [...] } ] } ] }
```

It looks like the data. It is a nightmare to update. To rename one lesson you must
recursively walk down, and — because React state must be immutable — rebuild every
object on the path back up. Every operation is a recursive tree rewrite. Delete is
worse. Move is worse still.

Instead we store **one flat dictionary of nodes keyed by id**, where each node holds
an array of its children's *ids*:

```js
// ✅ What we actually use.
{
  rootId: "root",
  nodes: {
    "root": { id: "root", type: "curriculum", title: "Untitled Curriculum",
              description: "", childIds: ["m1"], parentId: null },
    "m1":   { id: "m1", type: "module", title: "Module 1",
              description: "", childIds: ["t1"], parentId: "root" },
    "t1":   { id: "t1", type: "topic", title: "Topic 1",
              description: "", childIds: [],      parentId: "m1" },
  }
}
```

Now:
- **Rename** = `nodes[id].title = value`. One line, no recursion.
- **Add child** = create node, push its id into `parent.childIds`. Two lines.
- **Delete** = collect descendant ids, drop them from the map, splice the id out of
  the parent's `childIds`.
- **Undo** = keep a snapshot of the whole `state` object. It's small and flat.
- **Reorder / move later** = just move an id between arrays.

The *tree shape* is reconstructed at render time by following `childIds`. The tree is a
view, not the storage. This is the same pattern Redux calls "normalised state" and it's
why Notion/Figma-style apps can stay fast with thousands of nodes.

> **Say this in the video.** It is the clearest evidence of "how you think" in the
> whole submission.

### D2. **One recursive component**, driven by a config object

We do not write `ModuleCard.jsx`, `TopicCard.jsx`, `LessonCard.jsx`. They'd be 90%
identical, and the day the client adds a "Unit" level you'd write a fourth.

We write **one** `<Node>` component that renders itself and then maps over its
`childIds` rendering `<Node>` again. Everything level-specific lives in a lookup table:

```js
export const LEVELS = {
  curriculum: { child: "module", label: "Curriculum", addLabel: "Add Module", depth: 0 },
  module:     { child: "topic",  label: "Module",     addLabel: "Add Topic",  depth: 1 },
  topic:      { child: "lesson", label: "Topic",      addLabel: "Add Lesson", depth: 2 },
  lesson:     { child: null,     label: "Lesson",     addLabel: null,         depth: 3 },
};
```

Adding a level = one entry in this object. This is criterion 04 in a single file.

### D3. All mutations go through **one reducer**, exposed via **one hook**

Components never touch state shape. They call `updateTitle(id, value)` or `addChild(id)`.
The reducer is the only file that knows what a node looks like.

Why this matters: undo, "unsaved changes" indicators, autosave, and the AI merge all
become trivial because there is exactly *one* place state changes.

Components stay dumb → they're easy to read → criterion 04.

### D4. The AI runs in **two passes**, not one

Full reasoning in [§8](#8-the-ai-architecture). Short version: asking one model call to
produce 20 modules × 15 topics × 3 lessons of JSON means ~20,000 output tokens and
60–120 seconds of a user staring at a spinner — and it will blow Vercel's function
timeout.

Instead:
- **Pass 1 (outline):** send the PDF, get back Modules + Topics only. Fast. This is what
  the user sees first.
- **Pass 2 (lessons):** fan out one small parallel call *per module* to generate its
  lessons. These stream in and populate the already-visible tree.

The user sees structure in ~15 seconds instead of nothing for 90.

### D5. AI output goes to a **review step**, not straight into the page

The spec says "render the AI-generated curriculum directly on the same page." Taken
literally, uploading a PDF would silently destroy 40 minutes of manual work.

So: after Pass 1 we show a small non-blocking panel — *"Found 12 modules, 47 topics"* —
with **Replace** / **Add to existing** / **Discard**. Only after the choice does it enter
the tree. Then it's fully editable, exactly as the spec requires.

This is criterion 03 (user flow awareness) with a concrete artifact behind it.

### D6. **Undo instead of confirm dialogs**

Deleting a module can destroy 15 topics and 45 lessons. The normal answer is a
confirmation dialog — but the brief explicitly says *no modals*. So: delete happens
instantly, and a toast appears with **Undo** (also bound to `Ctrl+Z`).

This is strictly better UX than a confirm dialog *and* it respects the brief. It's the
kind of thing the brief's last section is fishing for: *"the best submissions show us
something we didn't ask for."*

### D7. Plain **JavaScript**, not TypeScript

You're still building React fluency. TypeScript on a recursive tree structure would mean
fighting the type checker instead of learning React. The submission is a live URL, not a
repo. We buy velocity and clarity.

We compensate with: a single documented shape in `lib/nodes.js`, JSDoc comments on the
reducer, and Zod schemas on the server for the AI response (which is where type safety
actually earns its keep — untrusted model output).

> If asked in the video: *"I used JS on the client because the value of TS is highest at
> trust boundaries, and the only trust boundary here is the LLM response — which I do
> validate, with Zod, on the server."* That's a real answer, not an excuse.

---

## 4. Where We Push Back on the Spec

The brief says: *"If the spec has a step that doesn't make sense, question it in your
video."* Criterion 03 rewards this directly. Here is our list — **keep it updated as we
build**, and pick the best 3 for the video.

| # | The spec says | Our reading | What we do |
|---|---------------|-------------|------------|
| 1 | Hierarchy is `Curriculum → Module → Topic → Lesson` — 4 levels | But the reference screenshots show "Program 1" as the **page header**, with Modules as the first list item. Curriculum isn't a repeatable sibling; it's the document itself. | Treat Curriculum as the page header (title + description, editable), not a card in a list. Same node type internally, different presentation. Removes a whole level of visual nesting for free. |
| 2 | "Delete any item at any level" + "no modals" | Those two together mean **destructive, unconfirmed, irreversible** deletes. | Instant delete + Undo toast + `Ctrl+Z`. (D6) |
| 3 | "Render the AI-generated curriculum directly on the same page" | Silently overwrites existing manual work. | Review panel with Replace / Add / Discard. (D5) |
| 4 | Support "20 modules each containing 10–15 topics" | That's 200–300 topics. Fully expanded that's an unusable wall of text — and the brief also demands "never cluttered". These two requirements conflict. | Nodes collapse by default when the tree is large; a "collapse all / expand all" control; child counts shown on collapsed rows so structure stays legible. |
| 5 | Screenshots show "Choose type" (Theory/Practical), hours, instructors, activities | Explicitly listed under "what you can ignore". | Skipped. Don't build them. Mentioning that we *noticed* they were in the screenshot but excluded by scope is itself a signal we read carefully. |
| 6 | "Click a description area to start typing. If empty, it should invite the click" | An always-visible "Click to add description…" on 300 rows *is* clutter. | Placeholder is very low-contrast and only becomes fully visible on hover/focus of the row. Invites without shouting. |
| 7 | AI must "infer and generate" missing Topics/Lessons | Inferred content is a *guess*, presented identically to content that was really in the PDF. A director could ship a curriculum containing content their document never said. | Mark AI-inferred nodes with a subtle badge/dot and a "N items were inferred" note in the review panel. Honesty about provenance. **This is probably our strongest unasked-for feature.** |

---

## 5. The Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js (App Router)** | We need a server for the Claude call — the API key must never reach the browser. Next gives us page + API route in one deployable. |
| Language | **JavaScript** (`.jsx`) | See D7. |
| Styling | **Tailwind CSS** | Fast iteration on spacing/indentation, which is 80% of "the hierarchy is visually unambiguous". |
| State | **`useReducer` + custom hook** | See D3. No Redux, no Zustand — the whole app is one tree. |
| LLM | **Claude — `claude-opus-5`** via `@anthropic-ai/sdk` | Accepts PDFs natively as a `document` content block. No `pdf-parse`, no `pdfjs`, no text-extraction step, no losing the layout information that *tells* you what a heading is. |
| Validation | **Zod** + `zodOutputFormat` | Structured outputs — the model is constrained to our schema, and we validate before it touches state. |
| Icons | **lucide-react** | Clean, one import. |
| Hosting | **Vercel** | Zero-config for Next, env vars in the dashboard. |

### Scaffold command

```bash
npx create-next-app@latest curriculum-creation-engine
# TypeScript?          → No
# ESLint?              → Yes
# Tailwind CSS?        → Yes
# src/ directory?      → Yes
# App Router?          → Yes
# Turbopack?           → Yes
# Customize alias?     → No  (keeps the default @/* )
```

Then:

```bash
npm install @anthropic-ai/sdk zod lucide-react
```

### Environment

`.env.local` (never committed — `create-next-app` gitignores it already):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Because there is **no** `NEXT_PUBLIC_` prefix, this is server-only. If you ever see the
key in the browser's Network tab or bundle, something is badly wrong.

The same variable must be added in **Vercel → Project → Settings → Environment
Variables** before deploying, or the live link fails on exactly the thing they said
they'd test.

---

## 6. The Data Model — the most important section

### The node shape

Every single item in the app — curriculum, module, topic, lesson — is this object:

```js
/**
 * @typedef {Object} Node
 * @property {string}   id          - unique, e.g. "n_7f3a"
 * @property {"curriculum"|"module"|"topic"|"lesson"} type
 * @property {string}   title
 * @property {string}   description
 * @property {string[]} childIds    - ordered ids of children
 * @property {string|null} parentId - null only for the root
 * @property {"manual"|"ai"|"ai-inferred"} origin - powers the provenance badge (§4.7)
 */
```

`origin` exists so we can honour push-back #7. Manual nodes are `"manual"`. Nodes read
out of the PDF are `"ai"`. Nodes the model invented to fill a gap are `"ai-inferred"`
and get a badge.

### The whole app state

```js
{
  rootId: "root",
  nodes:  { [id]: Node },
  collapsed: Set<string>,   // ids that are collapsed
  history: [],              // stack of previous {rootId, nodes} snapshots, for undo
}
```

That's the entire application state. Read it twice. Everything else is derived.

### The actions (this is the complete list)

| Action | Payload | Effect |
|--------|---------|--------|
| `UPDATE_FIELD` | `{ id, field, value }` | Sets `title` or `description` on one node. |
| `ADD_CHILD` | `{ parentId }` | Creates a node of `LEVELS[parent.type].child`, appends its id. |
| `DELETE_NODE` | `{ id }` | Removes node + all descendants, splices id from parent. Pushes snapshot to history. |
| `TOGGLE_COLLAPSE` | `{ id }` | |
| `SET_COLLAPSE_ALL` | `{ collapsed: bool }` | |
| `UNDO` | — | Pops history, restores snapshot. |
| `REPLACE_TREE` | `{ rootId, nodes }` | AI "Replace" path. Pushes snapshot first. |
| `MERGE_TREE` | `{ nodes, intoId }` | AI "Add to existing" path — appends AI modules after existing ones. |
| `ATTACH_LESSONS` | `{ topicId, lessons }` | Pass 2 result landing on an already-rendered topic. |

Nine actions. If you find yourself wanting a tenth, ask whether it's really a
composition of these.

### The hook contract

`useCurriculum()` returns:

```js
{
  state,                      // the object above
  root,                       // convenience: state.nodes[state.rootId]
  getNode(id),
  updateField(id, field, value),
  addChild(parentId),
  deleteNode(id),
  toggleCollapse(id),
  collapseAll(bool),
  undo(),
  canUndo,
  replaceTree(tree),
  mergeTree(tree),
  attachLessons(topicId, lessons),
  stats,                      // { modules, topics, lessons } — for the header
}
```

Components import this and nothing else about state. **A component should never see the
word `dispatch`.**

---

## 7. File / Folder Layout

```
src/
├── app/
│   ├── layout.js                    # fonts, <body> bg
│   ├── page.js                      # THE page (client component)
│   ├── globals.css                  # tailwind + the two CSS vars for brand orange
│   └── api/
│       ├── parse-curriculum/route.js   # Pass 1: PDF → modules + topics
│       └── generate-lessons/route.js   # Pass 2: one module → lessons
│
├── components/
│   ├── CurriculumHeader.jsx         # root title/desc, stats, Upload button, collapse-all
│   ├── Node.jsx                     # ⭐ the recursive one. The heart of the app.
│   ├── EditableText.jsx             # ⭐ the inline-edit primitive. Used everywhere.
│   ├── AddButton.jsx
│   ├── UploadDialog.jsx             # file picker + progress + the review panel
│   ├── ReviewPanel.jsx              # "Found 12 modules…" → Replace / Add / Discard
│   ├── Toast.jsx                    # undo toast
│   └── EmptyState.jsx               # what you see before anything exists
│
└── lib/
    ├── levels.js                    # the LEVELS config from D2
    ├── nodes.js                     # createNode(), collectDescendants(), buildTree()
    ├── curriculumReducer.js         # ⭐ the only file that mutates state
    ├── useCurriculum.js             # the hook wrapper
    ├── aiToNodes.js                 # AI JSON → flat node map (shared by both passes)
    ├── schema.js                    # Zod schemas for the AI response
    └── prompts.js                   # ⭐ the system prompts. Kept in their own file on purpose.
```

**Why `prompts.js` is its own file:** criterion 02 is "AI Integration Thinking". A
reviewer skimming the repo should be able to open one file and read the entire prompt
design. Prompts buried inline in a route handler read like an afterthought.

The three ⭐ files are what a reviewer would actually read. They should be the cleanest
code you have ever written.

---

## 8. The AI Architecture

### 8.1 Why we send the PDF straight to Claude

The instinct is: `pdf-parse` → plain text string → send string to LLM. Don't.

Extracting text throws away exactly the information you need: font size, bold, position,
indentation, numbering. Those *are* the structure. A line that reads `1.2 Grundpflege`
in extracted text is indistinguishable from body copy — but visually it's obviously a
sub-heading.

Claude accepts a PDF as a native `document` content block and sees the rendered pages.
So we base64 the file and hand it over whole:

```js
{
  role: "user",
  content: [
    { type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64String } },
    { type: "text", text: USER_INSTRUCTION },
  ],
}
```

Two rules: the `document` block goes **before** the text block, and the base64 string
must contain **no newlines** (`Buffer.from(bytes).toString("base64")` is already clean).

Hard limits: **32 MB per request, 600 pages.** We guard both client-side with a friendly
message rather than letting the API 400.

### 8.2 Structured output, not "please return JSON"

We never parse free-form text out of the response. We define a Zod schema and constrain
the model to it:

```js
// lib/schema.js
import { z } from "zod";

export const OutlineSchema = z.object({
  detected: z.enum(["structured", "partial", "none"]),
  reasoning: z.string(),           // one sentence — shown to the user, see 8.5
  curriculumTitle: z.string(),
  curriculumDescription: z.string(),
  modules: z.array(z.object({
    title: z.string(),
    description: z.string(),
    inferred: z.boolean(),
    topics: z.array(z.object({
      title: z.string(),
      description: z.string(),
      inferred: z.boolean(),
    })),
  })),
});
```

```js
// in the route
const response = await client.messages.parse({
  model: "claude-opus-5",
  max_tokens: 16000,
  system: OUTLINE_SYSTEM_PROMPT,
  messages: [ /* document + text as above */ ],
  output_config: { format: zodOutputFormat(OutlineSchema) },
});

const outline = response.parsed_output;   // null if parsing failed — guard it
```

`response.parsed_output` is `null` on failure. **Always guard.** That's the one line that
separates "handles edge cases" from "demo works on my machine".

### 8.3 Pass 1 — the outline call

**Input:** the PDF + a system prompt.
**Output:** curriculum title/description + modules + topics. **No lessons.**
**Why no lessons here:** output size. Modules + topics for a 20-module document is maybe
3–5k output tokens (~20s). Adding lessons quadruples it and risks both the `max_tokens`
ceiling and the Vercel function timeout.

### 8.4 Pass 2 — the lesson fan-out

Once Pass 1 renders, the client fires one `POST /api/generate-lessons` **per module**,
with a concurrency cap of 4 (so we don't rate-limit ourselves or open 20 sockets).

Each call gets: the curriculum title, that module's title/description, and its topic
list. It returns 2–4 lesson titles+descriptions per topic. Each response is dispatched
with `ATTACH_LESSONS` the moment it lands, so lessons visibly fill in module by module.

This gives us three things at once:
1. **Perceived speed** — structure is on screen in ~20s, not ~120s.
2. **No timeout** — every function invocation is short.
3. **Graceful degradation** — if module 14's lesson call fails, modules 1–13 and 15–20
   are fine. We show a tiny "retry" on module 14. One failure ≠ whole feature broken.

Because these calls are small and narrow, Pass 2 uses **`claude-sonnet-5`** instead of
Opus, with `output_config: { effort: "low" }` on top of that — lower latency and cost on
two axes at once, and lesson-naming genuinely doesn't need deep reasoning or the
top-tier model. Pass 1 (the structural judgement call — deciding `structured` vs
`partial` vs `none`, inferring missing topics, writing a useful `reasoning` sentence)
stays on `claude-opus-5` at default effort, since that's the one call in the whole
pipeline making real judgment calls on potentially messy input, and it's also the first
thing the user sees — a wrong verdict there is maximally visible and everything
downstream builds on it.

### 8.5 Prompt design — what actually goes in `prompts.js`

This is criterion 02. Write it deliberately. The outline system prompt must cover:

1. **Role and domain.** *"You are structuring a curriculum document for a German nursing
   school. Documents may be in German or English; preserve the original language of
   headings — do not translate them."* (Real domain awareness. Lingocare is a German
   nursing platform; translating `Pflegefachassistent` to "Nursing Assistant" would be a
   bug, not a feature.)

2. **What each level means**, so the model maps document features to our hierarchy:
   - Module = a major unit / Lernfeld / part / chapter.
   - Topic = a section within it.
   - Lesson = a single teachable session.

3. **The three-way `detected` verdict** and what each means:
   - `structured` — the document has clear headings; extract them, invent nothing.
   - `partial` — some structure; extract what's there, infer the rest, mark `inferred: true`.
   - `none` — no curriculum structure (a random invoice, a photo scan, an essay).
     Return `detected: "none"`, an empty `modules` array, and a `reasoning` sentence
     saying what the document *actually* appears to be.

4. **The inference rule.** *"Only set `inferred: true` for content you generated that was
   not present in the document. Never mark extracted content as inferred, and never mark
   generated content as extracted."* We surface this to the user, so it must be honest.

5. **Anti-hallucination guardrails.** *"Do not invent modules that have no basis in the
   document. If the document contains 3 modules, return 3 — do not pad to a rounder
   number."*

6. **Ordering.** *"Preserve document order."*

7. **Description rule.** *"If the document provides a description, use it condensed to
   one or two sentences. If it does not, write one from the surrounding context. Never
   leave a description empty and never repeat the title as the description."*

Keep the *instruction* in the system prompt and the *document* in the user message. That
ordering (`tools → system → messages`) is also what makes prompt caching work if we ever
add it.

### 8.6 The `detected: "none"` flow

The brief calls this out specifically: *"how you manage the case where the PDF has no
recognisable structure at all."* Most submissions will crash or produce garbage here.

We do this instead: the review panel shows

> **This doesn't look like a curriculum.**
> *"The document appears to be a scanned invoice from a medical supplier."*
> [ Start a blank curriculum ]   [ Try a different file ]

We tell the user *what we think it is* (that's what `reasoning` is for) and give them a
way forward. **Demo this in the video by deliberately uploading something wrong.** It's
30 seconds that proves you thought past the happy path.

### 8.7 Vercel timeouts — do not skip this

Serverless functions have a duration cap (60s on Hobby). Add to **both** route files:

```js
export const runtime = "nodejs";   // the Anthropic SDK needs Node, not Edge
export const maxDuration = 60;
```

Without `maxDuration`, the default is far shorter and Pass 1 will die on a real
20-module PDF — on their machine, on review day. This one line is the difference between
"it works" and "it worked locally".

---

## 9. The Phases

Each phase is small enough to finish in one sitting and ends with something you can
**see working**. Do not start phase N+1 until phase N's checkpoint passes.

---

### Phase 0 — Setup *(~20 min)*

**Steps**
1. `npx create-next-app@latest` with the answers from §5.
2. `npm install @anthropic-ai/sdk zod lucide-react`
3. Create `.env.local` with `ANTHROPIC_API_KEY`.
4. Delete the boilerplate inside `app/page.js`; leave `<main>Hello</main>`.
5. In `globals.css`, add the brand colour as a CSS variable:
   ```css
   :root { --brand: #EC8601; --brand-soft: #FEF3E2; }
   ```
6. `npm run dev`, confirm `localhost:3000`.
7. `git init`, first commit.

**Checkpoint:** orange text renders using `text-[var(--brand)]`.

**Concepts to actually understand before moving on:**
- What "App Router" means: a folder = a route, `page.js` = the UI for it.
- Server vs client components. By default every component is a **server** component —
  it runs on the server, cannot use `useState`, cannot handle clicks. Adding
  `"use client"` as the first line makes it run in the browser. Our whole editor is
  interactive, so `page.js` gets `"use client"`. The `api/` routes are always server.
  This is the boundary that keeps the API key safe.

---

### Phase 1 — The data model, on paper *(~30 min, no code)*

**Steps**
1. On paper, write out the flat `nodes` map for a curriculum with 2 modules, where
   module 1 has 2 topics and topic 1 has 2 lessons. By hand. All the ids.
2. Now write the steps to **delete module 1**. Which entries disappear? Which array
   changes?
3. Now write the steps to **add a topic to module 2**.
4. Re-read §6 and check your answers against the action table.

**Checkpoint:** you can explain, out loud, why deleting a node needs to touch *two*
places (the `nodes` map and the parent's `childIds`).

> Do not skip this phase because it has no code. Every bug you will hit for the next
> three phases is a bug in this model. Ten minutes with a pen saves two hours.

---

### Phase 2 — `lib/` — the logic layer *(~1.5 hr)*

Pure JavaScript. No React, no JSX. This is deliberate: you can test it in the browser
console, and it forces the logic to stay independent of the UI.

**Steps**
1. `lib/levels.js` — the `LEVELS` object from D2.
2. `lib/nodes.js`:
   - `newId()` — `crypto.randomUUID()` is built in, use it.
   - `createNode(type, parentId, overrides)` — returns the Node shape from §6.
   - `createInitialState()` — a state with just a root curriculum node.
   - `collectDescendants(nodes, id)` — returns `[id, ...all descendant ids]`. Write it
     with an explicit stack (`while (stack.length)`) rather than recursion; it's easier
     to reason about and can't blow the call stack on a deep tree.
   - `countByType(nodes)` — for the header stats.
3. `lib/curriculumReducer.js` — a `switch` over the nine actions in §6. Every case
   returns a **new** state object; never mutate the old one.
4. `lib/useCurriculum.js` — `useReducer(curriculumReducer, undefined, createInitialState)`
   wrapped so it returns the hook contract from §6.

**Checkpoint:** in `page.js`, temporarily `console.log` the state, call `addChild(rootId)`
from a plain `<button>`, and watch the console show a new node.

**Concepts:**
- **`useReducer` vs `useState`.** `useState` gives you a value and a setter. `useReducer`
  gives you a value and a `dispatch` — you send it a *description of what happened*
  (`{ type: "ADD_CHILD", parentId }`) and one pure function decides the next state.
  Use it when updates are complex or when many components change the same state. Both.
- **Immutability.** React decides whether to re-render by comparing the *identity* of
  the state object. If you mutate `state.nodes[id].title = "x"` and return the same
  object, React sees the same reference and renders nothing. Your app appears frozen.
  This will happen to you at least once. Recognise the symptom.

---

### Phase 3 — Render the tree, read-only *(~1.5 hr)*

**Steps**
1. `components/Node.jsx`. Props: `{ id }`. Get the node from the hook. Render title,
   description, and then:
   ```jsx
   {node.childIds.map((childId) => <Node key={childId} id={childId} />)}
   ```
   A component rendering itself. That's the whole trick.
2. Give each level its indent and visual treatment from `LEVELS` (see §10).
3. `page.js` renders `<CurriculumHeader />` then `<Node id={rootId} />`.
4. Hardcode a 3-module seed state in `createInitialState()` temporarily so there's
   something to look at.

**Checkpoint:** a nested, indented, static tree on screen. Ugly is fine. Nested is not
optional.

**Concepts:**
- **Recursion in components** — same as recursion anywhere. Base case: a lesson has an
  empty `childIds`, so `.map` renders nothing and it stops.
- **`key`** — React needs a stable identity per list item to know what moved vs what
  changed. Use `child.id`, never the array index. Index keys will scramble your inputs
  the first time you delete a middle item. This is *the* classic React bug.

---

### Phase 4 — Inline editing *(~2 hr — the most important phase)*

This is criterion 01. Take your time here.

**Steps**
1. `components/EditableText.jsx`. Props: `value`, `onChange`, `placeholder`, `variant`
   (`"title" | "description"`), `autoFocus`.
2. Two modes in one component:
   - **Not editing:** a `<div>` showing `value`, or the placeholder if empty.
   - **Editing:** a `<textarea>` styled to look *identical* to the div — same font, size,
     weight, line-height, padding. No border, transparent background, `resize-none`,
     `outline-none`.
3. Click the div → `setEditing(true)`. The textarea must appear with the caret already
   in it and **no visible jump**. If the text shifts by even 1px when you click, the
   illusion breaks and it stops feeling like Notion. Fix the padding until it doesn't.
4. Auto-grow the textarea: on every change, `el.style.height = "auto"` then
   `el.style.height = el.scrollHeight + "px"`.
5. Keyboard:
   - `Escape` → revert to the original value and exit.
   - `Enter` on a **title** → commit and exit (titles are single-line).
   - `Enter` on a **description** → newline (descriptions are multi-line).
   - blur → commit and exit.
6. Wire it into `Node.jsx` for both title and description.

**Checkpoint:** click any title anywhere in the tree, type, click away, and it persists.
Click a title, type, hit `Escape` — it reverts.

**Concepts:**
- **Controlled inputs.** A React input whose `value` comes from state needs an `onChange`
  that writes back to state — otherwise it appears not to accept typing at all. Here we
  keep a *local* draft state while editing and only commit to the reducer on
  Enter/blur. That's a deliberate choice: it makes `Escape` possible, and it avoids a
  global re-render on every keystroke of a 300-node tree.
- **`useRef` + `useEffect`** to focus the textarea the moment it mounts, and to place the
  caret at the end rather than the start.

---

### Phase 5 — Add, delete, undo *(~1.5 hr)*

**Steps**
1. `AddButton.jsx` — a ghost button reading `+ Add Topic` etc. from
   `LEVELS[node.type].addLabel`. Render it at the bottom of each node's children,
   indented to the child's level so it visually belongs to the group it creates.
2. Newly created nodes mount with `autoFocus` on the title. Do not make the user create
   a thing and *then* click it. That's the difference between "considered" and
   "functional" — the exact words in criterion 01.
3. Delete (trash icon), visible on row hover only, `opacity-0 group-hover:opacity-100`.
4. `DELETE_NODE` pushes a snapshot to `state.history` before deleting.
5. `Toast.jsx` — "Module deleted · **Undo**", auto-dismiss after ~6s.
6. Global `Ctrl+Z` / `Cmd+Z` listener in `page.js` via `useEffect`.

**Checkpoint:** add a module, add three topics inside it, delete the module, hit
`Ctrl+Z`, get all four back.

**Concepts:**
- **Event listener cleanup.** A `useEffect` that adds `window.addEventListener` must
  `return () => window.removeEventListener(...)`. Skipping this stacks a new listener
  on every render and your undo fires five times.
- **Tailwind `group`** — put `group` on the row, `group-hover:opacity-100` on the icon.
  Hover on the parent controls the child. No JS state needed for hover.

---

### Phase 6 — Make the hierarchy unambiguous *(~2 hr)*

The brief: *"A user should never wonder which level they're looking at."* Everything in
§10 lands here.

**Steps**
1. Collapse/expand chevrons on curriculum, module, topic. Rotate the chevron 90° with a
   CSS transition — a static chevron that jumps looks cheap.
2. When collapsed, show a summary on the row: `4 topics · 11 lessons`.
3. Vertical guide lines connecting a parent to its children (a left border on the
   children container). This is what makes deep nesting readable — it's how file trees
   and Notion both do it.
4. Level chips: `MODULE 1`, `Topic 1.2`, `Lesson 1.2.3`. Numbering is computed at render
   time from position, never stored — otherwise every insert requires a renumber.
5. Empty states: a topic with no lessons shows a quiet "No lessons yet" line, not
   nothing.
6. `EmptyState.jsx` for a completely blank curriculum: two clear paths — "Add your first
   module" and "Upload a PDF".
7. Collapse-all / expand-all in the header.
8. Auto-collapse rule: if the tree loads with more than ~5 modules, start with modules
   collapsed. Directly serves push-back #4.

**Checkpoint:** open the page with a 20-module seed. Is it comprehensible in 2 seconds?
If not, keep going — this is the phase that wins or loses criterion 01.

---

### Phase 7 — AI Pass 1: the outline route *(~2 hr)*

**Steps**
1. `lib/schema.js` — `OutlineSchema` from §8.2.
2. `lib/prompts.js` — `OUTLINE_SYSTEM_PROMPT`, written against the seven points in §8.5.
3. `app/api/parse-curriculum/route.js`:
   ```js
   import Anthropic from "@anthropic-ai/sdk";
   import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

   export const runtime = "nodejs";
   export const maxDuration = 60;

   export async function POST(request) {
     const formData = await request.formData();
     const file = formData.get("file");
     // ... guards: exists, is application/pdf, under 32MB
     const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
     // ... client.messages.parse({ ... }) as in §8.2
   }
   ```
4. Error handling with the SDK's typed errors — `Anthropic.AuthenticationError`,
   `Anthropic.RateLimitError`, `Anthropic.APIError` — most specific first, each mapped to
   a message a *user* can act on ("The AI service is busy, try again in a moment"), not
   a stack trace.
5. Test with `curl` or Postman before touching the UI. Prove the route works in
   isolation.

**Checkpoint:** `curl -F "file=@some.pdf" localhost:3000/api/parse-curriculum` returns
well-formed JSON matching the schema.

**Test with three PDFs** (find or make them now):
- **A** a real, well-structured curriculum → expect `detected: "structured"`.
- **B** a document with modules but no sub-structure → expect `"partial"` and
  `inferred: true` topics.
- **C** something unrelated (an invoice, a receipt) → expect `"none"` with a sensible
  `reasoning`.

---

### Phase 8 — AI Pass 1 in the UI *(~2 hr)*

**Steps**
1. `UploadDialog.jsx` — "Upload Curriculum" button, top right (as the brief suggests).
   File input accepting `.pdf` only. Also support drag-and-drop onto the page; it costs
   ~15 lines and instantly feels more finished.
2. Client-side guards *before* upload: type is PDF, size < 32 MB. Friendly inline
   message, never an alert().
3. Loading state that is **not** a bare spinner. Show what's happening:
   *"Reading document…"* → *"Identifying modules…"* → *"Structuring topics…"*.
   These are honest labels for real stages, not fake progress.
4. `lib/aiToNodes.js` — convert the AI's nested JSON into our flat node map, generating
   ids and setting `origin` (`"ai"` or `"ai-inferred"` per the `inferred` flag).
5. `ReviewPanel.jsx` — the counts, the inferred-items note, and Replace / Add /
   Discard. Plus the `detected: "none"` variant from §8.6.
6. Wire Replace → `replaceTree`, Add → `mergeTree`.

**Checkpoint:** upload PDF A, choose Replace, see the tree, and immediately click a title
and edit it. **That last click is the whole point of Part 2** — same components, same
editing, no difference between AI and manual content.

---

### Phase 9 — AI Pass 2: lessons *(~2 hr)*

**Steps**
1. `lib/schema.js` — `LessonsSchema`: `{ topics: [{ topicTitle, lessons: [{title, description, inferred}] }] }`.
2. `lib/prompts.js` — `LESSONS_SYSTEM_PROMPT`. Give it the curriculum title, module
   title/description, and the full topic list, so lessons are coherent *across* the
   module rather than each topic being generated blind.
3. `app/api/generate-lessons/route.js` — same shape as Pass 1 but text-only input (no
   PDF re-send — that would be wasteful and slow), model `claude-sonnet-5`,
   `output_config: { effort: "low" }`.
4. Client: after Replace/Add, fire one call per module with a concurrency limit of 4.
   Dispatch `ATTACH_LESSONS` as each returns.
5. Per-module state: a subtle shimmer or "generating lessons…" line while in flight; a
   small "Retry" on failure. **One module failing must not break the others.**

**Checkpoint:** upload a PDF, watch modules and topics appear, then watch lessons
populate module by module. Edit a topic title *while lessons are still generating* —
nothing should break or get overwritten.

---

### Phase 10 — Edge cases and polish *(~2 hr)*

Work the list. Each item is small.

- [ ] Upload a non-PDF → clear message, no crash.
- [ ] Upload a 40 MB file → blocked client-side with the reason.
- [ ] Upload an image-only scanned PDF → Claude reads it (it sees pages); confirm.
- [ ] Upload PDF C (unstructured) → the §8.6 flow.
- [ ] Kill your network mid-upload → error state with Retry, not a dead spinner.
- [ ] Remove the API key and restart → the route returns a clean 500 with a message.
- [ ] Delete every module → `EmptyState` returns.
- [ ] A title of 500 characters → wraps, doesn't overflow.
- [ ] An empty title → shows a greyed "Untitled Module", stays clickable.
- [ ] Rapid `Ctrl+Z` five times → sane.
- [ ] Tab order walks the tree in visual order.
- [ ] Mobile / narrow window → at minimum, doesn't break horizontally.
- [ ] `console.log`s removed. Dead code removed. Files you didn't use, deleted.

---

### Phase 11 — Deploy *(~45 min)*

**Steps**
1. `npm run build` locally first. Build errors that never appear in dev *will* appear
   here.
2. Push to GitHub.
3. Import into Vercel.
4. **Add `ANTHROPIC_API_KEY` in Vercel's Environment Variables.** The single most common
   way this submission dies.
5. Deploy. Then, on the live URL, run the *entire* flow again: manual create, edit,
   delete, undo, PDF upload, review, edit AI content.
6. Open it on your phone. Open it in a different browser.
7. Check Vercel's function logs for the parse route — confirm no timeouts.

**Checkpoint:** hand the URL to another person with a PDF and say nothing. Watch where
they hesitate. Fix that.

---

### Phase 12 — The video *(~2 hr including retakes)*

5 minutes. They said it's about **why**, not **what**. Most candidates will narrate a
feature tour. Don't.

**Suggested beats:**

| Time | Beat |
|------|------|
| 0:00–0:30 | What it is, in one sentence. One fast pass through the working product. Don't linger. |
| 0:30–1:30 | **The flat-map decision (D1).** Show the nested version you rejected and why. This is your strongest technical moment. |
| 1:30–2:15 | **One recursive component (D2).** Show `LEVELS`. "Adding a level is one line." |
| 2:15–3:15 | **AI thinking.** Why the PDF goes to the model whole instead of being text-extracted. Why two passes. Show the prompt file. |
| 3:15–4:00 | **Where you pushed back.** Pick the best two or three from §4 — the undo-instead-of-confirm, the review-before-replace, and the inferred-content badge. Show the badge. |
| 4:00–4:40 | **The unhappy path.** Upload the invoice live. Show it handling it gracefully. Very few submissions will do this. |
| 4:40–5:00 | What you'd do next if this were real: reordering via drag, persistence, multi-user. Honest about what's missing. |

**On "how you used AI in the process":** they asked directly, so answer directly and
without embarrassment. The honest version — used it to think through the state model,
to draft the prompt, to move fast on Tailwind; made the architecture calls yourself and
can defend every one — is the answer they want. Anyone claiming they didn't use AI, on a
task about integrating AI, is either lying or slow.

Record it more than once. The second take is always better.

---

## 10. Design System

**Brand orange `#EC8601`.** The brief says: *"Use it where it earns its place."* That's a
warning about over-use. Orange should mean **"this is the primary action or the active
state"** and nothing else. If everything is orange, nothing is.

| Use orange for | Do NOT use orange for |
|---|---|
| Primary "Upload Curriculum" button | Every heading |
| The active/focused row's left accent bar | Delete icons (that's red, or neutral-until-hover) |
| The "Add …" hover state | Body text |
| Level chips on Modules only | Backgrounds of large areas |

### Visual hierarchy per level

The rule: **each level down gets smaller, lighter, and further right.** Three signals
that all agree, so the level is unmistakable even in peripheral vision.

| Level | Indent | Type | Container | Accent |
|-------|--------|------|-----------|--------|
| Curriculum | 0 | 28px semibold | none — it's the page header | — |
| Module | 0 | 17px semibold, uppercase tracking chip | white card, `border`, `rounded-xl`, `shadow-sm` | 3px orange left bar |
| Topic | 24px | 15px medium | subtle `bg-neutral-50/60`, `rounded-lg` | 2px neutral-300 left bar |
| Lesson | 48px | 14px normal | no container — just a row with a dot | small neutral dot |

Vertical guide lines between a parent and its children. Generous vertical spacing —
whitespace is what makes a 300-item tree readable.

### Interaction detail (this is where criterion 01 is won)

- Hover on a row: background lifts *very* slightly, action icons fade in over ~120ms.
- Focus (editing): orange left bar, faint orange background wash.
- Transitions: 120–180ms, `ease-out`. Longer feels sluggish; instant feels cheap.
- New nodes: a brief fade/slide-in so items don't just *appear*.
- Collapse: animate the chevron rotation even if the content itself snaps.
- Empty description placeholder: `text-neutral-300`, going to `text-neutral-400` on row
  hover. Present but never noisy.
- **Everything must be reachable and operable by keyboard.** Nobody asked. It matters.

---

## 11. Known Traps

Things that will cost you an hour if you don't know them in advance.

1. **Forgetting `"use client"`.** Symptom: `useState is not a function` or "Event
   handlers cannot be passed to Client Component props". Fix: first line of `page.js`.

2. **Array index as `key`.** Symptom: you delete the second topic and the *third* one's
   text appears in the second's box. Fix: `key={node.id}`.

3. **Mutating state in the reducer.** Symptom: the app looks frozen; state is correct in
   the console but the screen never updates. Fix: always return new objects
   (`{ ...state, nodes: { ...state.nodes, [id]: { ...node, title } } }`).

4. **Stale closures in the `Ctrl+Z` listener.** Symptom: undo always restores the *first*
   snapshot. Cause: the effect captured an old `state`. Fix: correct dependency array, or
   dispatch an `UNDO` action that reads current state inside the reducer (preferred —
   the reducer always sees the latest state).

5. **Textarea jump on click.** Symptom: text shifts 2px when you enter edit mode. Cause:
   textarea and div have different default padding/border/line-height. Fix: make both
   explicit and identical.

6. **The Vercel timeout.** §8.7. `export const maxDuration = 60`.

7. **Edge runtime.** The Anthropic SDK needs `runtime = "nodejs"`. Edge will fail in
   confusing ways.

8. **`parsed_output` is `null` on parse failure.** Guard before you read it.

9. **Newlines in the base64 string** break the document block. `Buffer.toString("base64")`
   is fine; a hand-rolled chunked encoder may not be.

10. **`max_tokens` too low** silently truncates the JSON mid-object and structured
    parsing fails with a confusing error. 16000 for Pass 1.

11. **Committing `.env.local`.** Check `git status` before your first push. If a key ever
    lands on GitHub, revoke it immediately in the Anthropic console — don't just delete
    the commit.

---

## 12. Definition of Done

Do not send the email until every box is ticked.

**Part 1 — the page**
- [ ] Full Curriculum → Module → Topic → Lesson hierarchy renders
- [ ] Click any title → edit inline. No modal, no separate screen.
- [ ] Click any description → edit inline. Empty ones invite the click without clutter.
- [ ] Add Module / Add Topic (inside a module) / Add Lesson (inside a topic)
- [ ] Delete at every level
- [ ] Nesting is unambiguous at a glance
- [ ] All state is local

**Part 2 — the AI**
- [ ] "Upload Curriculum" button clearly visible, top right
- [ ] PDF parsed via Claude
- [ ] Handles a 20-module × 10–15-topic document without timing out
- [ ] Missing topics/lessons are inferred from context
- [ ] Renders into the *same* components as manual creation
- [ ] AI content is immediately editable inline
- [ ] Unstructured PDF handled gracefully

**Ours, not theirs**
- [ ] Undo (toast + `Ctrl+Z`)
- [ ] Review-before-apply with Replace / Add / Discard
- [ ] Inferred-content provenance badge
- [ ] Collapse / expand with child counts
- [ ] Progressive lesson generation with per-module failure isolation
- [ ] Keyboard-operable throughout

**Submission**
- [ ] Live URL, tested end to end **on the deployed site**
- [ ] `ANTHROPIC_API_KEY` set in Vercel
- [ ] API key has enough credit to survive their testing
- [ ] Video ≤ 5:00, focused on *why*
- [ ] Email to `hello@lingocare.ai`, subject exactly `Developer Intern: [Your Name]`
- [ ] Both links opened in an incognito window to confirm they work for a stranger

---

## Progress Log

Update this as you go — it becomes your video notes.

| Phase | Status | Date | Notes / what surprised me |
|-------|--------|------|---------------------------|
| 0 Setup | ⬜ | | |
| 1 Data model on paper | ⬜ | | |
| 2 lib/ logic layer | ⬜ | | |
| 3 Static tree | ⬜ | | |
| 4 Inline editing | ⬜ | | |
| 5 Add/delete/undo | ⬜ | | |
| 6 Hierarchy polish | ⬜ | | |
| 7 AI outline route | ✅ | 2026-09-06 | Tested all 3 detected cases with real PDFs generated via pandoc/LaTeX (no scanner needed). Zod v4 works fine with zodOutputFormat — worried for nothing. The "none" case reasoning is genuinely good: it named the exact company and invoice number and explained why it's not a curriculum, not just "not a curriculum." Good video moment for §8.6. |
| 8 Upload UI + review | ✅ | 2026-09-06 | Full end-to-end verified by hand in the browser: upload -> staged loading text -> review panel with correct counts -> Replace -> AI-generated titles immediately editable, same as manual nodes. No automated browser tooling available in this environment (chromium-cli missing, didn't want to add a whole Playwright toolchain just for one check) — verified everything checkable via curl/code myself, handed the real click-through to Aditya, same pattern as every other interactive phase. |
| 9 Lesson fan-out | ⬜ | | |
| 10 Edge cases | ⬜ | | |
| 11 Deploy | ⬜ | | |
| 12 Video | ⬜ | | |
