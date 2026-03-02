# JW Class Polls — Participation & Accuracy

Upload in-class poll screenshots, extract responses with Claude, match to your roster, and export **participation** and **in-class accuracy** for institutional reporting.

## Run locally

1. **Install and set API key**
   ```bash
   npm install
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and set `ANTHROPIC_API_KEY` (get one at [console.anthropic.com](https://console.anthropic.com/)).

2. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

3. **Optional: run with Vercel CLI locally**
   ```bash
   npx vercel dev
   ```
   This uses Vercel’s local dev server and simulates serverless routes.

## Deploy to Vercel

- Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
- In the project **Settings → Environment Variables**, add `ANTHROPIC_API_KEY`.
- Deploy. Session data is stored in memory and in `data/sessions.json` when the filesystem is writable (local); on Vercel you may want to add a database later for persistence.

## Flow

1. **Create a session** (name + date).
2. **Upload a screenshot** of a poll (two columns: **Users**, **Response**). Claude extracts names and responses.
3. **Set the correct answer** (A/B/C/D) for that question and **Save question**. Repeat for more screenshots (one per question).
4. **Load participation & accuracy** to see per-student stats; **Download CSV** or **Download JSON** for reporting.

Roster is read from `data/roster_sample.csv` (columns: `Student id`, `Name Surname`). Names from screenshots are matched to the roster (including variants like `IshaSubedi` → `Isha Subedi`).
