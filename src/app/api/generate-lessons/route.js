import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LessonsSchema } from "@/lib/schema";
import { LESSONS_SYSTEM_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Could not read the request." }, { status: 400 });
  }

  const { curriculumTitle, moduleTitle, moduleDescription, topics } = body;
  if (!curriculumTitle || !moduleTitle || !Array.isArray(topics) || topics.length === 0) {
    return Response.json({ error: "Missing or invalid module data." }, { status: 400 });
  }

  const userMessage = [
    `Curriculum: ${curriculumTitle}`,
    `Module: ${moduleTitle}`,
    moduleDescription ? `Module description: ${moduleDescription}` : null,
    "",
    "Topics:",
    ...topics.map((topic, i) => `${i + 1}. ${topic.title} — ${topic.description || "(no description)"}`),
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      system: LESSONS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(LessonsSchema), effort: "low" },
    });

    const lessons = response.parsed_output;
    if (!lessons) {
      return Response.json(
        { error: "The AI's response couldn't be understood. Please try again." },
        { status: 502 },
      );
    }

    return Response.json(lessons);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "The AI service isn't configured correctly. Please contact support." },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "The AI service is busy right now. Please try again in a moment." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json(
        { error: "The AI service returned an error. Please try again." },
        { status: 502 },
      );
    }
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
