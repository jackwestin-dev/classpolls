import fs from "fs";
import path from "path";

export type Session = {
  id: string;
  name: string;
  date: string;
  createdAt: string;
};

export type ExtractedRow = {
  name: string;
  response: string; // "" | "A" | "B" | "C" etc.
};

export type QuestionResult = {
  screenshotId: string;
  correctAnswer: string; // "" | "A" | "B" | "C"
  extracted: ExtractedRow[];
  matched: { student_id: number; name_surname: string; response: string }[];
  unmatched: { name: string; response: string }[];
};

export type SessionData = {
  session: Session;
  questions: QuestionResult[];
};

const DATA_FILE = path.join(process.cwd(), "data", "sessions.json");

function readData(): SessionData[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeData(data: SessionData[]) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // e.g. read-only filesystem on Vercel; keep in memory only
  }
}

let memoryStore: SessionData[] = [];

function getStore(): SessionData[] {
  try {
    const onDisk = readData();
    if (onDisk.length > 0) return onDisk;
  } catch {
    //
  }
  return memoryStore.length > 0 ? memoryStore : readData();
}

function persist(data: SessionData[]) {
  memoryStore = data;
  writeData(data);
}

export function getSessions(): Session[] {
  const data = getStore();
  return data.map((d) => d.session);
}

export function getSessionData(sessionId: string): SessionData | null {
  const data = getStore();
  return data.find((d) => d.session.id === sessionId) ?? null;
}

export function createSession(name: string, date: string): Session {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const session: Session = { id, name, date, createdAt: new Date().toISOString() };
  const all = getStore();
  all.push({ session, questions: [] });
  persist(all);
  return session;
}

export function addQuestionResult(
  sessionId: string,
  screenshotId: string,
  correctAnswer: string,
  extracted: ExtractedRow[],
  matched: QuestionResult["matched"],
  unmatched: QuestionResult["unmatched"]
): void {
  const all = getStore();
  const idx = all.findIndex((d) => d.session.id === sessionId);
  if (idx < 0) return;
  all[idx].questions.push({
    screenshotId,
    correctAnswer,
    extracted,
    matched,
    unmatched,
  });
  persist(all);
}

export function deleteSession(sessionId: string): void {
  const all = getStore().filter((d) => d.session.id !== sessionId);
  persist(all);
}
