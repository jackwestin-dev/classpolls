"use client";

import { useEffect, useState, useCallback } from "react";

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
  participation: {
    student_id: number;
    name_surname: string;
    participated: boolean;
    class_participation_pct: number;
    questions_answered: number;
    questions_total: number;
  }[];
  accuracy: {
    student_id: number;
    name_surname: string;
    in_class_accuracy_pct: number;
    correct: number;
    answered: number;
  }[];
  class_participation_rate: number;
};

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedRow[] | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    if (res.ok) setSessions(data.sessions ?? []);
  }, []);

  const loadSessionData = useCallback(async (id: string) => {
    setSessionError(null);
    setSessionLoading(true);
    setSessionData(null);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setSessionError(data.error || "Could not load session");
        return;
      }
      setSessionData(data);
      setSelectedId(id);
      setExtracted(null);
      setSummary(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedId) return;
    loadSessionData(selectedId);
  }, [selectedId, loadSessionData]);

  const handleCreateSession = async () => {
    setError(null);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newSessionName || "Unnamed session",
        date: newSessionDate,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create session");
      return;
    }
    setNewSessionName("");
    setNewSessionDate(new Date().toISOString().slice(0, 10));
    await loadSessions();
    if (data.session) setSelectedId(data.session.id);
  };

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

  const handleSaveQuestion = async () => {
    if (!selectedId || !extracted?.length) return;
    setSaving(true);
    setError(null);
    const screenshotId = `img_${Date.now()}`;
    try {
      const res = await fetch(`/api/sessions/${selectedId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenshotId,
          correctAnswer: correctAnswer.trim().toUpperCase().slice(0, 1),
          extracted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setExtracted(null);
      setCorrectAnswer("");
      await loadSessionData(selectedId);
      if (data.unmatchedNames?.length) {
        setError(`Unmatched names (review in results): ${data.unmatchedNames.join(", ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const loadSummary = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/export?sessionId=${selectedId}&format=json`);
    if (!res.ok) return;
    const data = await res.json();
    setSummary(data);
  }, [selectedId]);

  const exportJSON = () => {
    if (!selectedId) return;
    window.open(`/api/export?sessionId=${selectedId}&format=json`, "_blank");
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-8 border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-semibold text-stone-800">
          JW Class Polls — Participation &amp; Accuracy
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Upload poll screenshots, set correct answers, then export for institutional reporting.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-medium text-stone-700 mb-2">Sessions</h2>
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
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left rounded px-3 py-2 text-sm ${
                  selectedId === s.id
                    ? "bg-stone-200 font-medium"
                    : "hover:bg-stone-100"
                }`}
              >
                {s.name} — {s.date}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedId && sessionLoading && (
        <p className="mb-4 text-sm text-stone-500">Loading session…</p>
      )}
      {selectedId && sessionError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-800">
          {sessionError}
        </div>
      )}
      {sessionData && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-medium text-stone-700 mb-2">
              Session: {sessionData.session.name} ({sessionData.session.date})
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
              {extracting && (
                <p className="mt-1 text-sm text-stone-500">Extracting with Claude…</p>
              )}
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
                  <span className="ml-2 text-amber-600">
                    (some names could not be matched to roster — check export)
                  </span>
                )}
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-medium text-stone-700 mb-2">Export &amp; report</h2>
            <div className="flex gap-2 mb-4">
              <button
                onClick={loadSummary}
                className="rounded bg-stone-700 text-white px-4 py-2 text-sm font-medium hover:bg-stone-600"
              >
                Load participation &amp; accuracy
              </button>
              <a
                href={`/api/export?sessionId=${selectedId}&format=csv`}
                className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
              >
                Download CSV
              </a>
              <button
                onClick={exportJSON}
                className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
              >
                Download JSON (agent-readable)
              </button>
            </div>
            {summary && (
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-sm font-medium text-stone-700 mb-2">
                  Class participation rate: {summary.class_participation_rate}% (at least one
                  response)
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
                        const acc = summary.accuracy.find(
                          (a) => a.student_id === p.student_id
                        );
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
                  <p className="mt-2 text-xs text-stone-500">
                    Showing first 30. Full data in CSV/JSON export.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <footer className="mt-12 pt-4 border-t border-stone-200 text-xs text-stone-500">
        Add <code className="bg-stone-100 px-1 rounded">ANTHROPIC_API_KEY</code> to{" "}
        <code className="bg-stone-100 px-1 rounded">.env.local</code> for screenshot extraction.
        Run locally: <code className="bg-stone-100 px-1 rounded">npm run dev</code>.
      </footer>
    </div>
  );
}
