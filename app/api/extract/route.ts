import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const EXTRACT_SYSTEM = `You are extracting data from a screenshot of an in-class poll. The image has two columns: "Users" (left) and "Response" (right).
- Each row is one person. Extract every row.
- Users column: the name as shown (e.g. "Adiam Michael", "IshaSubedi").
- Response column: either empty/blank (no response) or a single letter like A, B, or C.
Respond with a JSON array only, no other text. Each element: { "name": "string", "response": "string" }. Use "" for blank response.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const base64 = body.image;
  if (!base64 || typeof base64 !== "string") {
    return NextResponse.json(
      { error: "Body must include { image: base64String }" },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const mediaType = "image/png";
  const data = base64.replace(/^data:image\/\w+;base64,/, "");

  // Use ANTHROPIC_EXTRACT_MODEL in .env.local to override if needed
  const model =
    process.env.ANTHROPIC_EXTRACT_MODEL ||
    "claude-sonnet-4-6";

  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: EXTRACT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data,
              },
            },
            {
              type: "text",
              text: "Return a JSON array of objects with keys name and response for every row in the Users and Response columns.",
            },
          ],
        },
      ],
    });

    const text =
      msg.content?.find((b) => b.type === "text")?.type === "text"
        ? (msg.content?.find((b) => b.type === "text") as { type: "text"; text: string }).text
        : "";
    const parsed = parseExtractResponse(text);
    return NextResponse.json({ rows: parsed });
  } catch (e) {
    console.error("Extract error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 500 }
    );
  }
}

function parseExtractResponse(text: string): { name: string; response: string }[] {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
  try {
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return [];
    return arr.map((o) => ({
      name: String(o?.name ?? "").trim(),
      response: String(o?.response ?? "").trim().toUpperCase().slice(0, 1) || "",
    }));
  } catch {
    return [];
  }
}
