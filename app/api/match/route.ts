import { NextRequest, NextResponse } from "next/server";
import { matchNameToRoster } from "@/lib/roster";

type RosterEntry = { student_id: number; name_surname: string };
type ExtractedRow = { name: string; response: string };

export async function POST(request: NextRequest) {
  let body: { roster: RosterEntry[]; extracted: ExtractedRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { roster, extracted } = body;
  if (!Array.isArray(roster) || !Array.isArray(extracted)) {
    return NextResponse.json(
      { error: "Body must include roster and extracted arrays" },
      { status: 400 }
    );
  }

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

  return NextResponse.json({
    matched,
    unmatched,
    unmatchedNames: unmatched.map((u) => u.name),
  });
}
