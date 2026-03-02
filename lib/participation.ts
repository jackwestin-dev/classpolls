import type { SessionData } from "./store";
import type { RosterEntry } from "./roster";

export type StudentParticipation = {
  student_id: number;
  name_surname: string;
  participated: boolean;
  class_participation_pct: number;
  questions_answered: number;
  questions_total: number;
};

export type StudentAccuracy = {
  student_id: number;
  name_surname: string;
  in_class_accuracy_pct: number;
  correct: number;
  answered: number;
};

export type SessionSummary = {
  session_id: string;
  session_name: string;
  session_date: string;
  participation: StudentParticipation[];
  accuracy: StudentAccuracy[];
  class_participation_rate: number; // % of roster who participated at least once
};

export function computeParticipationAndAccuracy(
  sessionData: SessionData,
  roster: RosterEntry[]
): SessionSummary {
  const totalQuestions = sessionData.questions.length;
  const byStudent = new Map<
    number,
    { name: string; answered: number; correct: number }
  >();

  for (const r of roster) {
    byStudent.set(r.student_id, {
      name: r.name_surname,
      answered: 0,
      correct: 0,
    });
  }

  for (const q of sessionData.questions) {
    const correctAnswer = (q.correctAnswer || "").trim().toUpperCase();
    for (const m of q.matched) {
      const cur = byStudent.get(m.student_id);
      if (!cur) continue;
      const responded = (m.response || "").trim().toUpperCase();
      if (responded) {
        cur.answered += 1;
        if (correctAnswer && responded === correctAnswer) cur.correct += 1;
      }
    }
  }

  const participation: StudentParticipation[] = [];
  const accuracy: StudentAccuracy[] = [];
  let participatedCount = 0;

  for (const [student_id, cur] of Array.from(byStudent.entries())) {
    const name = roster.find((r) => r.student_id === student_id)?.name_surname ?? cur.name;
    const questions_answered = cur.answered;
    const participated = questions_answered > 0;
    if (participated) participatedCount++;
    const class_participation_pct =
      totalQuestions > 0 ? Math.round((100 * questions_answered) / totalQuestions) : 0;
    participation.push({
      student_id,
      name_surname: name,
      participated,
      class_participation_pct,
      questions_answered,
      questions_total: totalQuestions,
    });
    const in_class_accuracy_pct =
      cur.answered > 0 ? Math.round((100 * cur.correct) / cur.answered) : 0;
    accuracy.push({
      student_id,
      name_surname: name,
      in_class_accuracy_pct,
      correct: cur.correct,
      answered: cur.answered,
    });
  }

  const class_participation_rate =
    roster.length > 0 ? Math.round((100 * participatedCount) / roster.length) : 0;

  return {
    session_id: sessionData.session.id,
    session_name: sessionData.session.name,
    session_date: sessionData.session.date,
    participation,
    accuracy,
    class_participation_rate,
  };
}
