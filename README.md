# بصيرة | Baseera Analytics

> من ملف مربك إلى قرار مفهوم.

**Baseera** is an Arabic-first analytics workspace that helps people explore their Excel and CSV files, clean them deliberately, check the calculations, and turn the result into a decision they can explain.

[Explore Baseera](https://baseera-analytics.osaidziad84.chatgpt.site) · Built by **Osaid Alhawamdeh — AI Engineer & Trainer**

![Baseera's journey from scattered data to a clear decision](public/baseera-story.png)

## Why Baseera?

A chart is easy to make. Knowing whether the file is sound, what changed during cleaning, and which rows support the conclusion takes more care. Baseera guides that process from the first upload to the final report.

## The journey

1. **Upload** an Excel workbook with multiple sheets, or a CSV/TSV file. A sample dataset is available to explore.
2. **Inspect** every row and column. Search, filter, sort, edit cells, and compare your working data with the original.
3. **Clean** with a preview of the effect before applying changes. Undo and redo edits as you work.
4. **Analyze** groups, trends, distributions, and correlations with calculations made from the data.
5. **Visualize** results in a dashboard with multiple cards and charts.
6. **Verify** the inputs and limits of a result, then write a report and save the project for later.

Negative values stay visible for review: in a sales file, for example, they might be legitimate returns.

## What works today

| Area | Capability |
| --- | --- |
| Data workspace | Multiple sheets, full table browsing, editing, search, filters, sorting, and original/working comparison |
| Data quality | Missing values, duplicates, inconsistent types and spacing, negative values, and outliers |
| Cleaning | Previewed transformations, explicit application, change history, undo and redo |
| Analysis | Grouped summaries, time trends, distributions, correlation, filters, and contributing rows |
| Dashboard & report | Multiple visualizations, verification checks, a decision note, and export/print options |
| Projects | Local draft, account-based cloud storage, and a portable project file |

The **AI Analysis Lab** can turn a question into a reviewable analysis plan using Gemini or Groq. Baseera's calculation engine produces the numbers; the model does not calculate them. Live AI requires a server-side API key and a configured model; manual analysis works without either.

## Try it

Open the [live site](https://baseera-analytics.osaidziad84.chatgpt.site), choose **«جرّب بملف جاهز»**, edit a cell, preview a cleaning step, and compare `sales_total` by `region`. Add that result to the dashboard, then check the rows behind it.

## Run locally

Requires Node.js `>=22.13.0` and pnpm.

```bash
git clone https://github.com/OsaidZiad04/baseera-analytics.git
cd baseera-analytics
pnpm install
pnpm dev
```

For checks and a production build:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

To configure AI locally, copy `.env.example` to `.env`, set `AI_PROVIDER`, `AI_MODEL`, and the corresponding `GROQ_API_KEY` or `GEMINI_API_KEY`. Keep API keys on the server and out of Git. For deployed use, set them as hosting secrets. See the [technical guide](docs/TECHNICAL.md) for data rules, limits, storage, and API behavior.

## Built with

React 19 · TypeScript · Vinext / Next.js · Tailwind CSS · Recharts · SheetJS · Cloudflare Workers · D1 · R2

## Author

**Osaid Alhawamdeh** — AI Engineer & Trainer

[Portfolio](https://osaidziad04.github.io/) · [LinkedIn](https://www.linkedin.com/in/osaid-z-alhawamdeh/) · [GitHub](https://github.com/OsaidZiad04)
