import { NextRequest, NextResponse } from "next/server";
import { computeParticipationAndAccuracy } from "@/lib/participation";
import type { SessionData } from "@/lib/store";
import type { RosterEntry } from "@/lib/roster";

export async function GET() {
  return NextResponse.json(
    { error: "Use POST with body: { sessionData, roster, format: 'csv' | 'json' }" },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  let body: {
    sessionData: SessionData;
    roster: RosterEntry[];
    format?: "csv" | "json";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { sessionData, roster, format = "json" } = body;
  if (!sessionData?.session || !Array.isArray(sessionData.questions) || !Array.isArray(roster)) {
    return NextResponse.json(
      { error: "Body must include sessionData (session + questions) and roster arrays" },
      { status: 400 }
    );
  }

  const summary = computeParticipationAndAccuracy(sessionData, roster);

  if (format === "csv") {
    const header =
      "student_id,name_surname,class_participation,participated_yes_no,in_class_accuracy_pct,questions_answered,questions_total";
    const rows = summary.participation.map((p) => {
      const acc = summary.accuracy.find((a) => a.student_id === p.student_id);
      return [
        p.student_id,
        `"${(p.name_surname || "").replace(/"/g, '""')}"`,
        p.class_participation_pct,
        p.participated ? "yes" : "no",
        acc?.in_class_accuracy_pct ?? 0,
        p.questions_answered,
        p.questions_total,
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="session_${sessionData.session.id}_export.csv"`,
      },
    });
  }

  return NextResponse.json({
    schema: "JW Class Polls export — agent-readable",
    session_id: summary.session_id,
    session_name: summary.session_name,
    session_date: summary.session_date,
    class_participation_rate: summary.class_participation_rate,
    participation: summary.participation,
    accuracy: summary.accuracy,
  });
}
