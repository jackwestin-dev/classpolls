import fs from "fs";
import path from "path";

export type RosterEntry = { student_id: number; name_surname: string };

/** Normalize name for matching: lowercase, collapse spaces, remove punctuation */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/** Try to match "IshaSubedi" style to "Isha Subedi" by inserting spaces and matching roster */
function trySplitMatch(extracted: string, roster: RosterEntry[]): RosterEntry | null {
  const norm = normalize(extracted).replace(/\s/g, "");
  if (norm.length < 2) return null;
  const rosterNorm = roster.map((r) => ({
    ...r,
    norm: normalize(r.name_surname).replace(/\s/g, ""),
    fullNorm: normalize(r.name_surname),
  }));
  // Exact no-space match
  const exact = rosterNorm.find((r) => r.norm === norm);
  if (exact) return { student_id: exact.student_id, name_surname: exact.name_surname };
  // Try adding spaces: "ishasubedi" -> "isha subedi" (match "Isha Subedi")
  for (let i = 1; i < norm.length; i++) {
    const left = norm.slice(0, i);
    const right = norm.slice(i);
    const withSpace = `${left} ${right}`;
    const match = rosterNorm.find((r) => r.fullNorm === withSpace);
    if (match) return { student_id: match.student_id, name_surname: match.name_surname };
  }
  // Try two spaces: first name, last name
  for (let i = 1; i < norm.length - 1; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const a = norm.slice(0, i);
      const b = norm.slice(i, j);
      const c = norm.slice(j);
      const withSpaces = [a, b, c].join(" ");
      const match = rosterNorm.find((r) => r.fullNorm === withSpaces);
      if (match) return { student_id: match.student_id, name_surname: match.name_surname };
    }
  }
  return null;
}

export function matchNameToRoster(
  extractedName: string,
  roster: RosterEntry[]
): { student_id: number; name_surname: string } | null {
  const n = normalize(extractedName);
  if (!n) return null;
  const exact = roster.find((r) => normalize(r.name_surname) === n);
  if (exact) return exact;
  const splitMatch = trySplitMatch(extractedName, roster);
  if (splitMatch) return splitMatch;
  return null;
}

export function loadRosterFromFile(filePath?: string): RosterEntry[] {
  const p = filePath ?? path.join(process.cwd(), "data", "roster_sample.csv");
  const content = fs.readFileSync(p, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const roster: RosterEntry[] = [];
  const header = lines[0].toLowerCase();
  const idCol = header.includes("student id") ? "student id" : "student_id";
  const nameCol = header.includes("name surname") ? "name surname" : "name_surname";
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);
    const id = parts[0]?.trim();
    const name = parts[1]?.trim();
    if (id && name && !isNaN(Number(id))) {
      roster.push({ student_id: Number(id), name_surname: name });
    }
  }
  return roster;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}
