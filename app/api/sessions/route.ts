import { NextRequest, NextResponse } from "next/server";
import { getSessions, createSession } from "@/lib/store";

export function GET() {
  const sessions = getSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body.name ?? "Unnamed session").trim() || "Unnamed session";
  const date = String(body.date ?? new Date().toISOString().slice(0, 10)).trim();
  const session = createSession(name, date);
  return NextResponse.json({ session });
}
