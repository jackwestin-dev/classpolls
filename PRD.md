# Product Requirements Document: JW Class Polls — Participation & Accuracy Reporting

**Version:** 1.0  
**Date:** March 2, 2025  
**Target:** Vercel deployment, Claude-powered build  
**Purpose:** Institutional reporting — poll participation and in-class accuracy per student, per session.

---

## 1. Executive Summary

Build a web app where instructors upload **screenshots of in-class polls**. The app uses **Claude (vision)** to extract structured data (who participated, what they answered, correctness). Outputs are **machine-readable** so an agent or reporting system can consume them, and align with an existing **CSV** that has a `class participation` column (percentage). The app must also support **in-class accuracy** reporting per session (e.g., % of correct answers per student per class).

---

## 2. Goals & Success Criteria

| Goal | Success Criteria |
|------|------------------|
| **Participation tracking** | Per-student, per-session participation %; exportable and readable by an agent. |
| **Accuracy tracking** | Per-student, per-session accuracy % (correct answers / answered questions). |
| **Institutional reporting** | Output format compatible with CSV/reporting (e.g., `class participation` as percentage). |
| **Instructor workflow** | Instructor uploads poll screenshots per session; app processes and stores results. |
| **Deployment** | Deployable on Vercel with minimal config. |

---

## 3. User Personas

- **Instructor:** Uploads poll screenshots, views/edits participation and accuracy, exports for reporting.
- **Institution / Reporting agent:** Consumes exported data (CSV or structured JSON) for compliance and reporting.

---

## 4. Data & Inputs

### 4.1 Roster (Canonical Student List)

- **File:** `data/roster_sample.csv` (in repo).
- **Columns:** `Student id`, `Name Surname`.
- **Purpose:** Canonical list of students; all participation and accuracy must be keyed by **student_id** (and optionally name). Extracted names from screenshots must be **matched to this roster** so output uses `Student id`.
- **Name matching:** Screenshots may show names in different formats (e.g., "IshaSubedi" with no space). The app must **normalize and match** to roster (e.g., fuzzy match "IshaSubedi" → "Isha Subedi" → student_id 123). Unmatched names should be flagged for instructor review.

### 4.2 Institutional Export CSV

- **Key column:** `class participation` — **percentage** (e.g., 0–100).
- **Requirement:** App output must include this column and be **agent-readable** (clear schema, consistent field names) for institutional reporting.

### 4.3 Instructor Input: Poll Screenshots

- **Format:** Images (PNG, JPEG) of in-class poll result screens.
- **Sample:** `assets/Screenshot_2026-02-25_at_6.20.16_PM-01fa8677-61b4-4ea3-8433-802417fb6d57.png` (in repo).

**Screenshot layout (from sample):**

- **Two columns:** `Users` (left) and `Response` (right).
- **Users:** Student names as shown by the poll tool (may run together, e.g. "IshaSubedi").
- **Response:** Either **blank** (no response = did not participate for that question) or a **single letter** (e.g., `A`, `B`, `C`) indicating the chosen option.
- **One screenshot = one poll question.** Multiple screenshots per session = multiple questions.

**Requirements for screenshot processing:**

- Use **Claude vision (image) API** to extract from each screenshot:
  - **Rows:** For each row, extract (name from "Users", response from "Response"). Blank response = no participation for that question.
  - **Correct answer:** Not visible on this screenshot format — the instructor must **provide the correct answer** (e.g., "A") per question/screenshot so the app can compute **right vs wrong** and thus in-class accuracy.
- **Match names to roster** to get `Student id` for every extracted row; flag unmatched for review.
- Support **multiple screenshots per session** (one image = one question).
- Instructor **associates screenshots with a session** and, per question, **optionally sets correct answer** (e.g., A/B/C).

---

## 5. Core Features & User Flows

### 5.1 Session Setup (Optional but Recommended)

- Create **sessions** (e.g., date, course name, section).
- Optionally define **expected roster** or **correct answers** per session so the app can compute accuracy.

### 5.2 Screenshot Upload & Processing

1. Instructor selects a **session** (or creates one).
2. Instructor **uploads one or more screenshots** (poll result screens).
3. App sends images to **Claude vision** with a structured prompt to extract:
   - **Participants:** list of identifiers (names or IDs).
   - **Responses:** per participant, per question (if multiple screens = multiple questions).
   - **Correct answer:** per question (if detectable from image or provided separately).
4. App stores **raw extracted data** and derived **participation** and **accuracy** metrics.

### 5.3 In-Class Activity Output (What Each Student Answered)

- **Purpose:** Report **what** each student submitted per question (for records and to compute right vs wrong).
- **Content:** Per session, per question (screenshot): list of (student_id, name, response). Response = blank, A, B, C, etc.
- **Use:** Enables “who answered what” and feeds into participation and accuracy. Must be **writable** (stored) and **readable by an agent** (e.g., JSON or CSV: student_id, session_id, question_id, response).

### 5.4 In-Class Participation Output (Who Participated)

- **Definition:** For a given session, participation = whether the student responded to at least one poll (or to N% of polls in that session).
- **Output:** Per student, per session: **participation %** (e.g., 100% if they answered all polls, or 50% if 1 of 2). Also a simple **participated: yes/no** per student per session.
- **Aggregate:** Session-level participation (e.g., % of roster who participated). This aligns with the institutional **class participation** column (percentage).
- **Requirement:** Output must be **readable by an agent** (e.g., student_id, session_id, class_participation_pct, participated_yes_no).

### 5.5 Right vs Wrong — In-Class Accuracy

- **Requirement:** App must **know what’s right and wrong** so it can report in-class accuracy. Correct answer is **not** on the screenshot; instructor provides it per question (e.g., “correct answer for this screenshot is A”).
- **Definition:** For a given session, accuracy = (number of correct answers) / (number of questions answered) per student, as %.
- **Output:** Per student, per session: **accuracy %**. Optionally: per-question breakdown (correct/incorrect/no response).
- **Aggregate:** Session-level accuracy (e.g., class average). Must be **writable** and **agent-readable** (e.g., student_id, session_id, in_class_accuracy_pct).

### 5.6 Export & Agent-Readable Output

- **Export formats:**
  - **CSV** with columns aligned to institutional needs, including at least:
    - Student identifier
    - Session/class identifier
    - `class participation` (percentage)
    - **In-class accuracy** (percentage) per session
  - **Structured JSON** (or similar) for agent consumption: same fields, clear schema, so an automated reporter can parse and fill institutional reports.
- **Documentation:** Provide a short **schema description** (field names, types, units) so an agent knows how to read the export.

---

## 6. Technical Direction

### 6.1 Stack (Recommendations for Claude Code)

- **Framework:** Next.js (App Router) or similar, for easy Vercel deploy.
- **Hosting:** Vercel.
- **AI:** Anthropic Claude API with **vision** (image input) for screenshot parsing.
- **Storage:** Start simple (e.g., SQLite or Vercel Postgres, or file-based JSON/CSV) for sessions, screenshot metadata, and extracted results. Scale to a real DB if needed.
- **Auth:** Optional for v1 (e.g., simple PIN or single-user); add proper auth if multiple instructors.

### 6.2 Key Implementation Notes

- **Prompt engineering:** Design a repeatable prompt that takes one or more poll screenshots and returns structured JSON (participants, responses, correct answers). Use the **actual sample screenshots** (once provided) in the prompt or few-shot examples to improve robustness.
- **Idempotency:** Same screenshot should yield same extraction (deterministic where possible).
- **Editable results:** Allow instructor to correct misread names or answers before finalizing; store both “raw” and “corrected” if useful for reporting.

---

## 7. Data Model (Conceptual)

- **Session:** id, name/date, course/section, optional correct-answers map.
- **Screenshot:** id, session_id, file ref, upload time, optional “question label.”
- **Extraction result:** screenshot_id, raw JSON from Claude (participants, responses, correct).
- **In-class activity:** (student_id, session_id, question_id) → response (A/B/C or blank).
- **Participation:** (student_id, session_id) → participation % for that session; class participation for export.
- **Accuracy:** (student_id, session_id) → accuracy % for that session (requires correct answer per question from instructor).
- **Export:** Rows with student_id, session_id, class participation %, in-class accuracy %; agent-readable schema.

---

## 8. Out of Scope (Initial Version)

- SSO / full institutional auth (can be phase 2).
- Real-time poll integration (only screenshot-based ingestion).
- Gradebook sync (export only; manual or agent-driven import elsewhere).

---

## 9. Deliverables Checklist for Build

- [ ] Vercel-deployable app (e.g., Next.js).
- [ ] Session creation/selection.
- [ ] Screenshot upload (one or more per session).
- [ ] **Roster:** Load and use `data/roster_sample.csv` (Student id, Name Surname); match extracted names to roster (handle variants like "IshaSubedi" → "Isha Subedi").
- [ ] Claude vision integration: extract from each screenshot **Users** and **Response** columns (name per row, response = blank or A/B/C).
- [ ] Instructor provides **correct answer** per question/screenshot (e.g., A/B/C) so app can compute right vs wrong.
- [ ] **In-class activity output:** Store and expose what each student answered (student_id, session_id, question_id, response); agent-readable.
- [ ] **In-class participation output:** Per student per session participation % and participated yes/no; align with `class participation` column.
- [ ] **In-class accuracy:** Per student per session accuracy % (correct / answered); agent-readable.
- [ ] CSV export with `class participation` and in-class accuracy, aligned to institutional CSV.
- [ ] Agent-readable export (JSON and/or CSV with documented schema).
- [ ] Use sample screenshot in `assets/` and roster in `data/roster_sample.csv` to design prompts and output format.

---

## 10. References for Implementation

- **Roster:** `data/roster_sample.csv` — columns `Student id`, `Name Surname`. Use for matching and for export (student_id in all outputs).
- **Sample screenshot:** `assets/Screenshot_2026-02-25_at_6.20.16_PM-01fa8677-61b4-4ea3-8433-802417fb6d57.png` — two-column layout (Users, Response); responses are blank or A/B/C.
- **Institutional CSV:** Export must include `class participation` (percentage) and in-class accuracy; schema documented for agent consumption.

Implementation should:
1. Load roster; implement name normalization and matching (e.g., "IshaSubedi" → "Isha Subedi" → student_id).
2. For each screenshot: Claude vision extracts rows (Users → name, Response → letter or blank). Instructor sets correct answer per question.
3. Map extracted rows → student_id via roster; store in-class activity (who answered what); compute participation % and accuracy %; export CSV/JSON with student_id, session_id, class participation %, in_class_accuracy %.

---

**End of PRD.** Use this document with Claude Code to implement the JW Class Polls app end-to-end (screenshot input → Claude vision → participation & accuracy → CSV/agent-ready export, Vercel-ready).
