import { NextResponse } from "next/server";
import { loadRosterFromFile } from "@/lib/roster";

export function GET() {
  try {
    const roster = loadRosterFromFile();
    return NextResponse.json({ roster });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load roster" },
      { status: 500 }
    );
  }
}
