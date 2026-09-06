import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { OutlineSchema } from "@/lib/schema";
import { OUTLINE_SYSTEM_PROMPT } from "@/lib/prompts";

// The Anthropic SDK needs Node's APIs, not the Edge runtime (Known Trap
// #7). maxDuration matters because Vercel's default function timeout is
// shorter than a real 20-module PDF can take to process (Known Trap #6)
// — without this, Pass 1 would work in local dev and die in production.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 32 * 1024 * 1024; // Claude's own PDF request limit

const client = new Anthropic();

export async function POST(request) {
  let file;
  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return Response.json(
      { error: "Could not read the upload. Please try again." },
      { status: 400 },
    );
  }

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return Response.json({ error: "Only PDF files are supported." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json(
      { error: "File is too large. The maximum size is 32 MB." },
      { status: 400 },
    );
  }

  // Buffer.toString("base64") never inserts newlines — a hand-rolled
  // chunked encoder might, and a newline inside the document block
  // breaks it (Known Trap #9).
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000, // too low silently truncates the JSON — Known Trap #10
      system: OUTLINE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            // document block before the text block — required ordering (§8.1)
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            { type: "text", text: "Structure this document into a curriculum outline." },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(OutlineSchema) },
    });

    // parsed_output is null on parse failure — always guard (§8.2, Known Trap #8)
    const outline = response.parsed_output;
    if (!outline) {
      return Response.json(
        { error: "The AI's response couldn't be understood. Please try again." },
        { status: 502 },
      );
    }

    return Response.json(outline);
  } catch (error) {
    // Most specific first, each mapped to a message a user can act on —
    // not a stack trace.
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
