import { z } from "zod";

export const MAX_CELLS = 250_000;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 12 * 1024 * 1024;
// getRandomValues also works in non-secure local previews; no Math.random IDs.
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export type Cell = string | number | boolean | null;
export const types = ["text", "number", "date", "category", "id"] as const;
export type ColumnType = typeof types[number];
export const typeLabels: Record<ColumnType, string> = { text: "نص", number: "رقم", date: "تاريخ", category: "فئة", id: "معرّف" };
export type Column = { id: string; name: string; type: ColumnType };
export type DataRow = { id: string; values: Record<string, Cell>; excluded?: boolean };
export type Sheet = { id: string; name: string; columns: Column[]; originalColumns: Column[]; rows: DataRow[]; originalRows: DataRow[] };
export type Change = { id: string; at: string; sheetId: string; label: string; affected: number };
export const filterSchema = z.object({ column: z.string().max(100), operator: z.enum(["eq", "neq", "contains", "gt", "gte", "lt", "lte", "empty", "not_empty"]), value: z.string().max(1000) });
export type DataFilter = z.infer<typeof filterSchema>;
export const planSchema = z.object({
  title: z.string().min(1).max(180),
  operation: z.enum(["group", "trend", "distribution", "correlation"]),
  metric: z.string().max(100),
  dimension: z.string().max(100),
  aggregation: z.enum(["sum", "average", "count", "min", "max"]),
  granularity: z.enum(["day", "month", "year"]),
  filters: z.array(filterSchema).max(8),
});
export type AnalysisPlan = z.infer<typeof planSchema>;
export type ChartKind = "bar" | "line" | "area" | "pie" | "scatter" | "table";
export type Card = { id: string; sheetId: string; title: string; plan: AnalysisPlan; chart: ChartKind; createdRevision: number };
export type Project = { notes: string; version: 2; id: string; name: string; fileName: string; createdAt: string; updatedAt: string; revision: number; sheets: Sheet[]; activeSheetId: string; history: Change[]; cards: Card[]; activePlan: AnalysisPlan | null; verifiedRevision: number | null };

const cellSchema = z.union([z.string().max(32767), z.number().finite(), z.boolean(), z.null()]);
const columnSchema = z.object({ id: z.string().regex(/^c\d+$/), name: z.string().min(1).max(200), type: z.enum(types) });
const rowSchema = z.object({ id: z.string().min(1).max(100), values: z.record(z.string().regex(/^c\d+$/), cellSchema), excluded: z.boolean().optional() });
const sheetSchema = z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100), columns: z.array(columnSchema).min(1).max(150), originalColumns: z.array(columnSchema).min(1).max(150), rows: z.array(rowSchema).max(100000), originalRows: z.array(rowSchema).max(100000) });
export const projectSchema = z.object({
  notes: z.string().max(3000).default(''), version: z.literal(2), id: z.string().uuid(), name: z.string().min(1).max(180), fileName: z.string().max(250), createdAt: z.string(), updatedAt: z.string(), revision: z.number().int().nonnegative(),
  sheets: z.array(sheetSchema).min(1).max(40), activeSheetId: z.string(), history: z.array(z.object({ id: z.string(), at: z.string(), sheetId: z.string(), label: z.string().max(1000), affected: z.number().int().nonnegative() })).max(500),
  cards: z.array(z.object({ id: z.string(), sheetId: z.string(), title: z.string().max(180), plan: planSchema, chart: z.enum(["bar", "line", "area", "pie", "scatter", "table"]), createdRevision: z.number() })).max(24),
  activePlan: planSchema.nullable(), verifiedRevision: z.number().nullable(),
}).superRefine((p, ctx) => {
  const cellCount = p.sheets.reduce((n, s) => n + Math.max(s.rows.length, s.originalRows.length) * s.columns.length, 0);
  if (cellCount > MAX_CELLS) ctx.addIssue({ code: "custom", message: "يتجاوز المشروع حد 250 ألف خلية." });
  if (!p.sheets.some(s => s.id === p.activeSheetId)) ctx.addIssue({ code: "custom", message: "الورقة النشطة غير موجودة." });
  if (new Set(p.sheets.map(s => s.id)).size !== p.sheets.length) ctx.addIssue({ code: "custom", message: "معرّفات الأوراق مكررة." });
  for (const s of p.sheets) {
    if (new Set(s.columns.map(c => c.id)).size !== s.columns.length || new Set(s.rows.map(r => r.id)).size !== s.rows.length || new Set(s.originalRows.map(r => r.id)).size !== s.originalRows.length) ctx.addIssue({ code: "custom", message: "معرّفات الأعمدة أو الصفوف مكررة." });
  }
});
export function validateProject(value: unknown): Project { const result = projectSchema.safeParse(value); if (!result.success) throw new Error('المشروع غير صالح أو يتجاوز حدود 250 ألف خلية، 100 ألف صف، و150 عمودًا لكل ورقة.'); return result.data; }
export const label = (v: Cell | undefined) => v === null || v === undefined || v === "" ? "—" : String(v);
export const isMissing = (v: Cell | undefined) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
export function numberValue(v: Cell | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)).replace(/٫/g, ".").replace(/٬/g, ",");
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s.replaceAll(",", "")); return Number.isFinite(n) ? n : null;
}
export function isoDate(v: Cell | undefined): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v.trim())) return null;
  const s = v.trim().slice(0, 10), date = new Date(s + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s ? s : null;
}
export function inferType(name: string, values: Cell[]): ColumnType {
  if (/(?:^|[_\s])(id|code|phone|zip|postal)(?:$|[_\s])|معرف|معرّف|هاتف|رقم.*طلب|رمز/i.test(name)) return "id";
  const present = values.filter(v => !isMissing(v));
  if (!present.length) return "text";
  if (present.every(v => isoDate(v))) return "date";
  if (present.filter(v => numberValue(v) !== null).length / present.length >= .95 && !present.some(v => typeof v === "string" && /^0\d+/.test(v))) return "number";
  return new Set(present.map(String)).size <= Math.max(12, present.length / 5) ? "category" : "text";
}
export function makeSheet(name: string, grid: Cell[][], index: number): Sheet {
  if (!grid.length) throw new Error("الورقة فارغة");
  const width = grid.reduce((n, row) => Math.max(n, row.length), 0);
  if (width > 150) throw new Error("الحد الحالي 150 عمودًا لكل ورقة.");
  const used = new Set<string>();
  const names = Array.from({ length: width }, (_, i) => { const base = String(grid[0][i] ?? "").trim().slice(0, 185) || `عمود ${i + 1}`; let name = base, n = 2; while (used.has(name)) name = `${base} (${n++})`; used.add(name); return name; });
  const rows: DataRow[] = grid.slice(1).filter(r => r.some(v => !isMissing(v))).map((r, i) => ({ id: `s${index}r${i + 2}`, values: Object.fromEntries(names.map((_, j) => [`c${j}`, r[j] ?? null])) }));
  const columns = names.map((name, i) => ({ id: `c${i}`, name, type: inferType(name, rows.map(r => r.values[`c${i}`])) }));
  return { id: `sheet${index}`, name, columns, originalColumns: structuredClone(columns), rows, originalRows: structuredClone(rows) };
}
export function newProject(fileName: string, sheets: Sheet[]): Project {
  const now = new Date().toISOString();
  return validateProject({ notes: '', version: 2, id: uuid(), name: fileName.replace(/\.[^.]+$/, ""), fileName, createdAt: now, updatedAt: now, revision: 0, sheets, activeSheetId: sheets[0]?.id, history: [], cards: [], activePlan: null, verifiedRevision: null });
}
export function parseDelimited(text: string): Cell[][] {
  text = text.replace(/^\uFEFF/, "");
  const candidates = [",", ";", "\t"].map(delimiter => {
    let n = 0, quoted = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; } else if (!quoted && (ch === '\r' || ch === '\n')) break; else if (!quoted && ch === delimiter) n++; }
    return { delimiter, n };
  });
  const delimiter = candidates.sort((a, b) => b.n - a.n)[0].delimiter;
  const grid: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (quoted || cell === "") quoted = !quoted; else cell += ch; }
    else if (ch === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { row.push(cell); grid.push(row); row = []; cell = ""; if (ch === "\r" && text[i + 1] === "\n") i++; }
    else cell += ch;
  }
  if (quoted) throw new Error("CSV يحتوي علامات اقتباس غير مغلقة؛ راجع الملف قبل الاستيراد.");
  if (cell.length || row.length) { row.push(cell); grid.push(row); }
  if (grid.length < 2) throw new Error("يجب أن يحتوي الملف صف عناوين وصف بيانات على الأقل.");
  const width = grid[0].length;
  if (grid.some(r => r.length > width)) throw new Error("توجد صفوف تحتوي حقولًا أكثر من العناوين. راجع الفاصل أو صف العناوين.");
  return grid;
}
export function demoProject(): Project {
  const sales: Cell[][] = [["order_id", "date", "region", "product", "quantity", "sales_total", "cost"]];
  const regions = ["الشمال", "الجنوب", "الوسط", "الشرق"];
  for (let i = 0; i < 144; i++) {
    const month = 1 + Math.floor(i / 24), quantity = 1 + i % 9, region = regions[i % 4], price = [35, 50, 80][i % 3];
    const revenue = quantity * price * (region === "الجنوب" && month >= 4 ? .7 : 1);
    sales.push([`ORD-${String(i + 1).padStart(4, "0")}`, `2026-${String(month).padStart(2, "0")}-${String(1 + i % 24).padStart(2, "0")}`, i === 7 ? "الشرق " : region, ["سماعات", "لوحة مفاتيح", "شاشة"][i % 3], i === 10 ? null : quantity, i === 20 ? -70 : i === 35 ? 6500 : revenue, Math.round(quantity * price * .55 * 100) / 100]);
  }
  sales.push([...sales[12]]);
  return newProject("Baseera_Sales_Demo.xlsx", [makeSheet("المبيعات", sales, 0), makeSheet("دليل المنتجات", [["product", "category", "note"], ["سماعات", "إكسسوارات", "القيمة السالبة في المبيعات قد تمثل مرتجعًا"], ["لوحة مفاتيح", "إكسسوارات", "البيانات اصطناعية للتجربة"], ["شاشة", "أجهزة", "ستة أشهر من المبيعات"]], 1)]);
}
