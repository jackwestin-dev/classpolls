import { NextRequest, NextResponse } from "next/server";
import { getSessionData, deleteSession } from "@/lib/store";

type Params = { params: { id: string } };

export function GET(_request: NextRequest, { params }: Params) {
  const id = params.id;
  const data = getSessionData(id);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(data);
}

export function DELETE(_request: NextRequest, { params }: Params) {
  deleteSession(params.id);
  return NextResponse.json({ ok: true });
}
