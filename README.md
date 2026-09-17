# بصيرة | Baseera Analytics

> من ملف مربك إلى قرار مفهوم.

**Baseera Analytics** is an Arabic-first, guided data-analysis experience built for people who want to understand their Excel or CSV files without getting lost between formulas, sheets, and technical jargon.

It turns data analysis into a clear journey: upload, understand, inspect, clean, analyze, visualize, verify, and communicate the decision.

[Live Demo](https://baseera-analytics.osaidziad84.chatgpt.site) · Built by **Osaid Alhawamdeh — AI Engineer & Trainer**

![Baseera Analytics — from data chaos to a clear decision](public/baseera-story.png)

## Why Baseera?

The challenge is rarely the numbers themselves. The real questions are:

- Where should I start?
- Can I trust this file?
- What changed after cleaning?
- Does the chart actually support the conclusion?
- How can I explain the result responsibly?

Baseera answers these questions through a structured, interactive workflow rather than presenting users with a crowded dashboard from the first screen.

## The Analysis Journey

1. **Upload** — Read CSV, XLSX, or XLS files directly in the browser.
2. **Understand** — Profile rows, columns, data types, and sample records.
3. **Inspect Quality** — Detect missing values, duplicates, negative values, and inconsistent text.
4. **Clean by Decision** — Apply explicit cleaning policies and see their impact.
5. **Baseera AI Analysis Lab** — Ask a question, review the proposed plan, select metrics and dimensions, then run the analysis.
6. **Design** — Explore KPIs, comparisons, filters, and charts.
7. **Verify** — Check calculations, evidence, and the limits of each claim.
8. **Decide** — Generate a concise decision brief that can be presented or printed.

## Current Features

- Arabic-first RTL interface
- Modern responsive analytics workspace
- Excel and CSV parsing inside the browser
- Guided onboarding and sample dataset
- Automatic data profiling
- Data-quality scoring and issue detection
- Interactive cleaning policies
- Natural-language analysis-question interface
- Reviewable analysis plan before execution
- Traceable KPIs, charts, and evidence table
- Responsible interpretation with explicit limitations
- Interactive dashboard filters
- Verification checklist
- Printable decision report
- Session persistence while moving between stages

## Tech Stack

- React 19
- TypeScript
- Next.js / Vinext
- Tailwind CSS
- Recharts
- SheetJS (`xlsx`)
- Lucide Icons
- Cloudflare Workers-compatible runtime

## Run Locally

### Requirements

- Node.js `>=22.13.0`
- pnpm

```bash
git clone https://github.com/OsaidZiad04/baseera-analytics.git
cd baseera-analytics
pnpm install
pnpm dev
```

Then open the local URL printed in the terminal.

To create a production build:

```bash
pnpm build
```

## Privacy Note

In the current version, uploaded files are parsed inside the user's browser. For training and demonstrations, use non-sensitive or synthetic datasets.

## Product Direction

Baseera is being developed gradually as both:

- a practical analytics product, and
- an interactive learning environment for teaching data analysis with AI.

Planned improvements include deeper question understanding, richer statistical analysis, smarter chart selection, reusable analysis sessions, and a real AI reasoning layer with transparent evidence and guardrails.

## Author

**Osaid Alhawamdeh**  
AI Engineer & Trainer

- [Portfolio](https://osaidziad04.github.io/)
- [LinkedIn](https://www.linkedin.com/in/osaid-z-alhawamdeh/)
- [GitHub](https://github.com/OsaidZiad04)

---

Built with a simple idea: data analysis should feel like a guided conversation, not a fight with spreadsheets.
