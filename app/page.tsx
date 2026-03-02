"use client";

import { useEffect, useState, useCallback } from "react";
import { computeParticipationAndAccuracyClient } from "@/lib/participationClient";

const ROSTER_KEY = "jw_class_polls_roster";
const SESSIONS_KEY = "jw_class_polls_sessions";

type RosterEntry = { student_id: number; name_surname: string };
type Session = { id: string; name: string; date: string; createdAt: string };
type ExtractedRow = { name: string; response: string };
type QuestionResult = {
  screenshotId: string;
  correctAnswer: string;
  extracted: ExtractedRow[];
  matched: { student_id: number; name_surname: string; response: string }[];
  unmatched: { name: string; response: string }[];
};
type SessionData = {
  session: Session;
  questions: QuestionResult[];
};
type Summary = {
  session_id: string;
  session_name: string;
  session_date: string;
  participation: { student_id: number; name_surname: string; participated: boolean; class_participation_pct: number; questions_answered: number; questions_total: number }[];
  accuracy: { student_id: number; name_surname: string; in_class_accuracy_pct: number; correct: number; answered: number }[];
  class_participation_rate: number;
};

function parseRosterCsv(csv: string): RosterEntry[] {
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const roster: RosterEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").trim());
    const id = parts[0];
    const name = parts[1];
    if (id && name && !isNaN(Number(id))) {
      roster.push({ student_id: Number(id), name_surname: name });
    }
  }
  return roster;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterInput, setRosterInput] = useState("");
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsData, setSessionsData] = useState<Record<string, SessionData>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedRow[] | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const persistRoster = useCallback((r: RosterEntry[]) => {
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(r));
    } catch {}
  }, []);

  const persistSessions = useCallback((sList: Session[], data: Record<string, SessionData>) => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify({ sessions: sList, data }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROSTER_KEY);
      if (raw) {
        const r = JSON.parse(raw);
        if (Array.isArray(r) && r.length > 0) setRoster(r);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const { sessions: sList, data } = JSON.parse(raw);
        if (Array.isArray(sList)) setSessions(sList);
        if (data && typeof data === "object") setSessionsData(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSessionData(null);
      return;
    }
    setSessionData(sessionsData[selectedId] ?? null);
    setSummary(null);
  }, [selectedId, sessionsData]);

  const loadDefaultRoster = useCallback(async () => {
    setRosterError(null);
    try {
      const res = await fetch("/api/roster");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load roster");
      const r = data.roster ?? [];
      setRoster(r);
      persistRoster(r);
    } catch (e) {
      setRosterError(e instanceof Error ? e.message : "Failed to load roster");
    }
  }, [persistRoster]);

  const applyRosterFromInput = useCallback(() => {
    setRosterError(null);
    const r = parseRosterCsv(rosterInput);
    if (r.length === 0) {
      setRosterError("No valid rows. Use CSV with header: Student id, Name Surname");
      return;
    }
    setRoster(r);
    persistRoster(r);
    setRosterInput("");
  }, [rosterInput, persistRoster]);

  const handleReset = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!confirm("Clear roster and all sessions? This cannot be undone.")) return;
    localStorage.removeItem(ROSTER_KEY);
    localStorage.removeItem(SESSIONS_KEY);
    setRoster([]);
    setRosterInput("");
    setSessions([]);
    setSessionsData({});
    setSelectedId(null);
    setSessionData(null);
    setSummary(null);
    setExtracted(null);
    setRosterError(null);
    setError(null);
  }, []);

  const handleCreateSession = useCallback(() => {
    setError(null);
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const session: Session = {
      id,
      name: newSessionName.trim() || "Unnamed session",
      date: newSessionDate,
      createdAt: new Date().toISOString(),
    };
    const data: SessionData = { session, questions: [] };
    const newList = [...sessions, session];
    const newData = { ...sessionsData, [id]: data };
    setSessions(newList);
    setSessionsData(newData);
    setSelectedId(id);
    setSessionData(data);
    setNewSessionName("");
    setNewSessionDate(new Date().toISOString().slice(0, 10));
    persistSessions(newList, newData);
  }, [newSessionName, newSessionDate, sessions, sessionsData, persistSessions]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setExtracted(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setExtracting(true);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Extraction failed");
        setExtracted(data.rows ?? []);
        setCorrectAnswer("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Extraction failed");
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaveQuestion = useCallback(async () => {
    if (!selectedId || !sessionData || !extracted?.length) return;
    if (roster.length === 0) {
      setError("Add a roster first (paste CSV or Load default).");
      return;
    }
    setSaving(true);
    setError(null);
    const screenshotId = `img_${Date.now()}`;
    const correct = correctAnswer.trim().toUpperCase().slice(0, 1);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster, extracted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match failed");
      const question: QuestionResult = {
        screenshotId,
        correctAnswer: correct,
        extracted,
        matched: data.matched ?? [],
        unmatched: data.unmatched ?? [],
      };
      const updated = {
        ...sessionData,
        questions: [...sessionData.questions, question],
      };
      const newData = { ...sessionsData, [selectedId]: updated };
      setSessionsData(newData);
      setSessionData(updated);
      setExtracted(null);
      setCorrectAnswer("");
      persistSessions(sessions, newData);
      if (data.unmatchedNames?.length) {
        setError(`Unmatched names: ${data.unmatchedNames.join(", ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [selectedId, sessionData, sessionsData, sessions, extracted, correctAnswer, roster, persistSessions]);

  const loadSummary = useCallback(() => {
    if (!sessionData || roster.length === 0) return;
    const s = computeParticipationAndAccuracyClient(
      { session: sessionData.session, questions: sessionData.questions },
      roster
    );
    setSummary(s as Summary);
  }, [sessionData, roster]);

  const handleExport = useCallback(
    async (format: "csv" | "json") => {
      if (!sessionData || roster.length === 0) {
        setError("Select a session with questions and ensure roster is set.");
        return;
      }
      setExporting(true);
      setError(null);
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionData, roster, format }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Export failed");
        }
        if (format === "csv") {
          const text = await res.text();
          downloadBlob(new Blob([text], { type: "text/csv" }), `session_${sessionData.session.id}_export.csv`);
        } else {
          const json = await res.json();
          downloadBlob(
            new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }),
            `session_${sessionData.session.id}_export.json`
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setExporting(false);
      }
    },
    [sessionData, roster]
  );

  const handleCopySummary = useCallback(() => {
    if (!sessionData || roster.length === 0) return;
    const s = computeParticipationAndAccuracyClient(
      { session: sessionData.session, questions: sessionData.questions },
      roster
    );
    const lines = [
      `Session: ${s.session_name} (${s.session_date})`,
      `Class participation rate: ${s.class_participation_rate}%`,
      "",
      "student_id\tname_surname\tparticipation_%\taccuracy_%",
      ...s.participation.map((p) => {
        const acc = s.accuracy.find((a) => a.student_id === p.student_id);
        return `${p.student_id}\t${p.name_surname}\t${p.class_participation_pct}\t${acc?.in_class_accuracy_pct ?? 0}`;
      }),
    ];
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      () => setError("Copy failed")
    );
  }, [sessionData, roster]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-8 border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-semibold text-stone-800">
          JW Class Polls — Participation &amp; Accuracy
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Set your roster first, then create sessions, upload poll screenshots, and export for reporting.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* Roster — first */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-stone-700 mb-2">1. Roster</h2>
        {roster.length > 0 ? (
          <p className="text-sm text-stone-600 mb-2">
            <strong>{roster.length} students</strong> loaded. Paste new CSV below to replace, or Reset to clear.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 items-start mb-2">
          <textarea
            placeholder="Paste CSV with header: Student id, Name Surname"
            value={rosterInput}
            onChange={(e) => setRosterInput(e.target.value)}
            rows={4}
            className="flex-1 min-w-[200px] rounded border border-stone-300 px-3 py-2 text-sm font-mono"
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={applyRosterFromInput}
              className="rounded bg-stone-800 text-white px-4 py-2 text-sm font-medium hover:bg-stone-700"
            >
              Use pasted roster
            </button>
            <button
              onClick={loadDefaultRoster}
              className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Load default roster
            </button>
          </div>
        </div>
        {rosterError && (
          <p className="text-sm text-red-600 mb-2">{rosterError}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
          >
            Reset all (clear roster and sessions)
          </button>
        </div>
      </section>

      {/* Sessions */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-stone-700 mb-2">2. Sessions</h2>
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <input
            type="text"
            placeholder="Session name"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            className="rounded border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={newSessionDate}
            onChange={(e) => setNewSessionDate(e.target.value)}
            className="rounded border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreateSession}
            className="rounded bg-stone-800 text-white px-4 py-2 text-sm font-medium hover:bg-stone-700"
          >
            Create session
          </button>
        </div>
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left rounded px-3 py-2 text-sm ${
                  selectedId === s.id ? "bg-stone-200 font-medium" : "hover:bg-stone-100"
                }`}
              >
                {s.name} — {s.date}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {sessionData && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-medium text-stone-700 mb-2">
              3. Session: {sessionData.session.name} ({sessionData.session.date})
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-600 mb-1">
                Add poll screenshot (Users + Response columns)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileSelect}
                disabled={extracting}
                className="block text-sm text-stone-600 file:mr-2 file:rounded file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-sm"
              />
              {extracting && <p className="mt-1 text-sm text-stone-500">Extracting with Claude…</p>}
            </div>

            {extracted && extracted.length > 0 && (
              <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
                <p className="text-sm font-medium text-stone-700 mb-2">
                  Extracted rows ({extracted.length}) — set correct answer then Save
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-sm text-stone-600">Correct answer:</label>
                  <select
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    className="rounded border border-stone-300 px-2 py-1 text-sm"
                  >
                    <option value="">—</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                  <button
                    onClick={handleSaveQuestion}
                    disabled={saving}
                    className="rounded bg-stone-800 text-white px-3 py-1.5 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save question"}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto text-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-1 pr-4">Name</th>
                        <th className="text-left py-1">Response</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extracted.map((r, i) => (
                        <tr key={i} className="border-b border-stone-100">
                          <td className="py-1 pr-4">{r.name || "—"}</td>
                          <td className="py-1">{r.response || "(blank)"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sessionData.questions.length > 0 && (
              <div className="rounded border border-stone-200 p-3 text-sm text-stone-600">
                <strong>Saved questions:</strong> {sessionData.questions.length}
                {sessionData.questions.some((q) => q.unmatched.length > 0) && (
                  <span className="ml-2 text-amber-600">(some names unmatched to roster)</span>
                )}
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-medium text-stone-700 mb-2">4. Export &amp; report</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={loadSummary}
                className="rounded bg-stone-700 text-white px-4 py-2 text-sm font-medium hover:bg-stone-600"
              >
                Load participation &amp; accuracy
              </button>
              <button
                onClick={() => handleExport("csv")}
                disabled={exporting}
                className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                Download CSV
              </button>
              <button
                onClick={() => handleExport("json")}
                disabled={exporting}
                className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                Download JSON (agent-readable)
              </button>
              <button
                onClick={handleCopySummary}
                className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
              >
                {copySuccess ? "Copied!" : "Copy summary to clipboard"}
              </button>
            </div>
            {summary && (
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-sm font-medium text-stone-700 mb-2">
                  Class participation rate: {summary.class_participation_rate}%
                </p>
                <div className="max-h-64 overflow-y-auto text-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-1 pr-4">Student</th>
                        <th className="text-left py-1 pr-4">Participation %</th>
                        <th className="text-left py-1">Accuracy %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.participation.slice(0, 30).map((p) => {
                        const acc = summary.accuracy.find((a) => a.student_id === p.student_id);
                        return (
                          <tr key={p.student_id} className="border-b border-stone-100">
                            <td className="py-1 pr-4">
                              {p.name_surname} ({p.student_id})
                            </td>
                            <td className="py-1 pr-4">{p.class_participation_pct}%</td>
                            <td className="py-1">{acc?.in_class_accuracy_pct ?? 0}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {summary.participation.length > 30 && (
                  <p className="mt-2 text-xs text-stone-500">Showing first 30. Full data in CSV/JSON.</p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <footer className="mt-12 border-t border-stone-200 pt-4 text-xs text-stone-500">
        Roster and sessions are stored in this browser. Set <code className="bg-stone-100 px-1 rounded">ANTHROPIC_API_KEY</code> in Vercel for screenshot extraction.
      </footer>
    </div>
  );
}
