import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/store";
import { loadRosterFromFile } from "@/lib/roster";
import { computeParticipationAndAccuracy } from "@/lib/participation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const format = searchParams.get("format") || "json"; // json | csv

  if (!sessionId) {
    return NextResponse.json(
      { error: "Query param sessionId is required" },
      { status: 400 }
    );
  }

  const data = getSessionData(sessionId);
  if (!data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const roster = loadRosterFromFile();
  const summary = computeParticipationAndAccuracy(data, roster);

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
        "Content-Disposition": `attachment; filename="session_${sessionId}_export.csv"`,
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
