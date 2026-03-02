import { NextRequest, NextResponse } from "next/server";
import { getSessionData, addQuestionResult } from "@/lib/store";
import { loadRosterFromFile, matchNameToRoster } from "@/lib/roster";

type ExtractedRow = { name: string; response: string };

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  const data = getSessionData(sessionId);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  let body: { screenshotId: string; correctAnswer: string; extracted: ExtractedRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { screenshotId, correctAnswer, extracted } = body;
  if (!screenshotId || !Array.isArray(extracted)) {
    return NextResponse.json(
      { error: "Body must include screenshotId and extracted array" },
      { status: 400 }
    );
  }

  const roster = loadRosterFromFile();
  const matched: { student_id: number; name_surname: string; response: string }[] = [];
  const unmatched: { name: string; response: string }[] = [];

  for (const row of extracted) {
    const name = String(row?.name ?? "").trim();
    const response = String(row?.response ?? "").trim().toUpperCase().slice(0, 1) || "";
    const entry = matchNameToRoster(name, roster);
    if (entry) {
      matched.push({
        student_id: entry.student_id,
        name_surname: entry.name_surname,
        response,
      });
    } else if (name) {
      unmatched.push({ name, response });
    }
  }

  const correct = (correctAnswer ?? "").trim().toUpperCase().slice(0, 1) || "";
  addQuestionResult(
    sessionId,
    screenshotId,
    correct,
    extracted.map((r) => ({
      name: String(r?.name ?? "").trim(),
      response: String(r?.response ?? "").trim().toUpperCase().slice(0, 1) || "",
    })),
    matched,
    unmatched
  );

  return NextResponse.json({
    ok: true,
    matched: matched.length,
    unmatched: unmatched.length,
    unmatchedNames: unmatched.map((u) => u.name),
  });
}
