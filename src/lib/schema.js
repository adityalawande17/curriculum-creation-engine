import { z } from "zod";

/**
 * Pass 1 (outline) output shape. Constrained via structured outputs —
 * the model literally cannot return anything that doesn't match this,
 * so there's no free-form JSON parsing to guard against on our side.
 *
 * No lessons here on purpose — see D4/§8.3 in CLAUDE.md. Lessons come
 * from Pass 2 (LessonsSchema, added when that route is built).
 */
export const OutlineSchema = z.object({
  detected: z.enum(["structured", "partial", "none"]),
  reasoning: z.string(),
  curriculumTitle: z.string(),
  curriculumDescription: z.string(),
  modules: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      inferred: z.boolean(),
      topics: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          inferred: z.boolean(),
        }),
      ),
    }),
  ),
});

/**
 * Pass 2 (lessons) output shape. `topicTitle` — not a topic id — is
 * deliberate: this route never sees our internal node ids, only the
 * plain-text topic list we send it. The client matches lessons back to
 * the right topic node by title within the one module this call covers.
 *
 * `inferred` here means something narrower than in OutlineSchema: this
 * route never sees the original PDF, only the topic's title and
 * description (which Pass 1 already condensed from the real document).
 * So "not inferred" means "clearly implied by that description" —
 * "inferred" means "nothing given suggested this specific lesson; it
 * came from general domain knowledge." See prompts.js for the exact
 * instruction.
 */
export const LessonsSchema = z.object({
  topics: z.array(
    z.object({
      topicTitle: z.string(),
      lessons: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          inferred: z.boolean(),
        }),
      ),
    }),
  ),
});
