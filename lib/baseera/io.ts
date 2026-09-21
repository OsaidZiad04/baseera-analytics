import { Cell, DataRow, MAX_FILE_BYTES, MAX_CELLS, MAX_PROJECT_BYTES, Project, Sheet, makeSheet, newProject, parseDelimited, validateProject } from "./model";
export async function importWorkbook(file: File): Promise<Project> {
  if (file.size > MAX_FILE_BYTES) throw new Error("الحد الحالي للملف 20 MB.");
  if (/\.baseera\.json$/i.test(file.name)) return validateProject(JSON.parse(await file.text()));
  let sheets: Sheet[];
  if (/\.(csv|tsv)$/i.test(file.name)) sheets = [makeSheet("البيانات", parseDelimited(await file.text()), 0)];
  else if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true, dense: false });
    if (wb.SheetNames.length > 40) throw new Error("الحد الحالي 40 ورقة.");
    let total = 0;
    sheets = wb.SheetNames.flatMap((name, i) => {
      const ws = wb.Sheets[name];
      if (!ws["!ref"]) return [];
      const range = XLSX.utils.decode_range(ws["!ref"]);
      if (range.e.c - range.s.c + 1 > 150) throw new Error(`الورقة «${name}» تتجاوز 150 عمودًا.`);
      total += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
      if (total > MAX_CELLS) throw new Error("الحد الحالي 250 ألف خلية في الملف. قسّمه إلى ملفات أصغر.");
      const grid = XLSX.utils.sheet_to_json<(Cell | Date)[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
      if (grid.length < 1) return [];
      return [makeSheet(name, grid.map(r => r.map(v => v instanceof Date ? v.toISOString().slice(0, 10) : v)), i)];
    });
  } else throw new Error("اختر Excel أو CSV أو ملف مشروع .baseera.json");
  if (!sheets.length) throw new Error("لم أجد أوراق بيانات داخل الملف.");
  return newProject(file.name, sheets);
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  // A visible download link retains the user gesture across async Excel generation.
  // The workspace owns the object URL until the user closes or replaces the export.
  window.dispatchEvent(new CustomEvent('baseera-export-ready', { detail: { url, name } }));
}
export function saveProjectFile(project: Project) {
  const text = JSON.stringify(project);
  if (new Blob([text]).size > MAX_PROJECT_BYTES) throw new Error("المشروع كبير للتصدير بصيغته الكاملة. صدّر أوراق Excel منفصلة.");
  downloadBlob(new Blob([text], { type: "application/json" }), `${safeName(project.name)}.baseera.json`);
}
export function safeName(name: string) { return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 100) || "Baseera"; }
export function csvText(sheet: Sheet, rows = sheet.rows.filter(r => !r.excluded)) {
  // Prevent spreadsheet formula execution when exported strings start with formula markers.
  const csvCell = (v: Cell | undefined) => { let s = v == null ? "" : String(v); if (typeof v === "string" && /^[\s]*[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  const lines = [sheet.columns.map(c => csvCell(c.name)).join(","), ...rows.map(r => sheet.columns.map(c => csvCell(r.values[c.id])).join(","))];
  return "\uFEFF" + lines.join("\r\n");
}
export function exportCsv(sheet: Sheet, rows = sheet.rows.filter(r => !r.excluded)) {
  downloadBlob(new Blob([csvText(sheet, rows)], { type: "text/csv;charset=utf-8" }), `${safeName(sheet.name)}.csv`);
}
export async function excelBlob(project: Project) {
  const XLSX = await import("xlsx"), wb = XLSX.utils.book_new(), names = new Set<string>();
  for (const s of project.sheets) {
    const base = s.name.replace(/[\\/?*\[\]:]/g, "_").replace(/^'+|'+$/g, '').slice(0, 27) || 'Sheet'; let name = base, n = 1;
    while (names.has(name.toLowerCase())) name = base.slice(0, 24) + `_${n++}`;
    names.add(name.toLowerCase());
    const rows = s.rows.filter(r => !r.excluded);
    const grid = [s.columns.map(c => c.name), ...rows.map(r => s.columns.map(c => r.values[c.id] ?? null))];
    const ws = XLSX.utils.aoa_to_sheet(grid); XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export async function exportExcel(project: Project) {
  downloadBlob(await excelBlob(project), `${safeName(project.name)}_edited.xlsx`);
}
export function gridForRows(sheet: Sheet, rows: DataRow[]) { return rows.map(r => Object.fromEntries(sheet.columns.map(c => [c.name, r.values[c.id]]))); }
