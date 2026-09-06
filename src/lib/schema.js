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
