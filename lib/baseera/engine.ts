import { AnalysisPlan, Cell, Column, DataFilter, DataRow, isMissing, isoDate, label, numberValue, planSchema, Sheet } from './model';

export const fmt = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
export const activeRows = (sheet: Sheet) => sheet.rows.filter(r => !r.excluded);
export const aggregateLabels = { sum: 'المجموع', average: 'المتوسط', count: 'عدد الصفوف', min: 'الأدنى', max: 'الأعلى' };
export const operationLabels = { group: 'مقارنة المجموعات', trend: 'الاتجاه الزمني', distribution: 'توزيع رقمي', correlation: 'علاقة بين رقمين' };
export const filterLabels = { eq: 'يساوي', neq: 'لا يساوي', contains: 'يحتوي', gt: 'أكبر من', gte: 'أكبر أو يساوي', lt: 'أصغر من', lte: 'أصغر أو يساوي', empty: 'فارغ', not_empty: 'غير فارغ' };
export function matches(row: DataRow, filter: DataFilter): boolean {
  const v = row.values[filter.column], op = filter.operator;
  if (op === 'empty') return isMissing(v);
  if (op === 'not_empty') return !isMissing(v);
  if (op === 'contains') return !isMissing(v) && String(v).toLocaleLowerCase().includes(filter.value.toLocaleLowerCase());
  if (op === 'eq' || op === 'neq') { const same = String(v ?? '') === filter.value; return op === 'eq' ? same : !same; }
  const a = numberValue(v), b = numberValue(filter.value);
  if (a === null || b === null) return false;
  return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
}
export function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p, base = Math.floor(position), remainder = position - base;
  return sorted[base] + remainder * ((sorted[base + 1] ?? sorted[base]) - sorted[base]);
}
export function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, sum, average: values.length ? sum / values.length : null, min: sorted[0] ?? null, max: sorted.at(-1) ?? null, median: quantile(sorted, .5), q1: quantile(sorted, .25), q3: quantile(sorted, .75) };
}
export type Issue = { kind: 'missing' | 'duplicate' | 'invalid' | 'spaces' | 'negative' | 'outlier'; rowId: string; columnId: string; value: Cell | undefined; note: string };
export const issueLabels: Record<Issue['kind'], string> = { missing: 'خلايا فارغة', duplicate: 'صفوف مكررة بالكامل', invalid: 'مخالفة نوع العمود', spaces: 'مسافات زائدة', negative: 'قيم سالبة للمراجعة', outlier: 'قيم متطرفة للمراجعة' };
export function inspectSheet(sheet: Sheet) {
  const rows = activeRows(sheet), issues: Issue[] = [], seen = new Set<string>();
  const summaries = sheet.columns.map(column => {
    const numbers = column.type === 'number' ? rows.flatMap(r => { const n = numberValue(r.values[column.id]); return n === null ? [] : [n]; }) : [];
    const s = stats(numbers), iqr = s.q1 !== null && s.q3 !== null ? s.q3 - s.q1 : null;
    const distinct = new Set(rows.filter(r => !isMissing(r.values[column.id])).map(r => JSON.stringify(r.values[column.id]))).size;
    let missing = 0, invalid = 0;
    for (const row of rows) {
      const value = row.values[column.id], add = (kind: Issue['kind'], note: string) => issues.push({ kind, rowId: row.id, columnId: column.id, value, note });
      if (isMissing(value)) { missing++; add('missing', 'القيمة غير متوفرة؛ اختر سياستها بحسب السياق.'); continue; }
      if ((column.type === 'number' && numberValue(value) === null) || (column.type === 'date' && !isoDate(value))) { invalid++; add('invalid', 'القيمة لا تطابق النوع المحدد للعمود.'); }
      if (typeof value === 'string' && value !== value.trim()) add('spaces', 'مسافات في بداية النص أو نهايته.');
      const n = column.type === 'number' ? numberValue(value) : null;
      if (n !== null && n < 0) add('negative', 'قد تكون قيمة صحيحة مثل مرتجع أو رصيد سالب.');
      if (n !== null && numbers.length >= 4 && iqr !== null && s.q1 !== null && s.q3 !== null && (n < s.q1 - 1.5 * iqr || n > s.q3 + 1.5 * iqr)) add('outlier', 'خارج حدود 1.5 × IQR؛ مؤشر للمراجعة وليس خطأً مؤكدًا.');
    }
    return { column, ...s, distinct, missing, invalid };
  });
  for (const row of rows) {
    const key = JSON.stringify(sheet.columns.map(c => row.values[c.id] ?? null));
    if (seen.has(key)) issues.push({ kind: 'duplicate', rowId: row.id, columnId: '', value: null, note: 'نسخة إضافية مطابقة لجميع قيم الأعمدة.' });
    else seen.add(key);
  }
  return { issues, summaries, rowCount: rows.length, counts: Object.fromEntries(Object.keys(issueLabels).map(kind => [kind, issues.filter(i => i.kind === kind).length])) as Record<Issue['kind'], number> };
}
export function defaultPlan(sheet: Sheet): AnalysisPlan {
  return { title: 'تحليل جديد', operation: 'group', metric: sheet.columns.find(c => c.type === 'number')?.id ?? '', dimension: sheet.columns.find(c => ['category', 'text'].includes(c.type))?.id ?? sheet.columns[0].id, aggregation: sheet.columns.some(c => c.type === 'number') ? 'sum' : 'count', granularity: 'month', filters: [] };
}
export function validatePlan(sheet: Sheet, input: unknown): AnalysisPlan {
  const plan = planSchema.parse(input), col = (id: string) => sheet.columns.find(c => c.id === id);
  for (const f of plan.filters) {
    if (!col(f.column)) throw new Error('عمود التصفية غير موجود.');
    if (['gt', 'gte', 'lt', 'lte'].includes(f.operator) && numberValue(f.value) === null) throw new Error('قيمة المقارنة الرقمية غير صالحة.');
  }
  if (plan.aggregation !== 'count' || ['distribution', 'correlation'].includes(plan.operation)) if (col(plan.metric)?.type !== 'number') throw new Error('اختر عمودًا من النوع الرقمي للمقياس.');
  if (plan.operation !== 'distribution' && !col(plan.dimension)) throw new Error('اختر عمود التقسيم أو المقارنة.');
  if (plan.operation === 'trend' && col(plan.dimension)?.type !== 'date') throw new Error('الاتجاه الزمني يحتاج عمودًا من النوع تاريخ بتنسيق YYYY-MM-DD.');
  if (plan.operation === 'correlation' && (col(plan.dimension)?.type !== 'number' || plan.metric === plan.dimension)) throw new Error('اختر عمودين رقميين مختلفين لدراسة العلاقة.');
  return plan;
}
export type Point = { name: string; value: number | null; rows: number; valid: number; x?: number; y?: number };
export type AnalysisResult = { points: Point[]; rows: number; totalRows: number; valid: number; skipped: number; summary: ReturnType<typeof stats>; correlation: number | null; plan: AnalysisPlan };
export function analyze(sheet: Sheet, input: AnalysisPlan): AnalysisResult {
  const plan = validatePlan(sheet, input), all = activeRows(sheet), rows = all.filter(r => plan.filters.every(f => matches(r, f)));
  const numeric = rows.flatMap(r => { const n = numberValue(r.values[plan.metric]); return n === null ? [] : [n]; });
  let points: Point[] = [], valid = 0, skipped = 0, correlation: number | null = null; const contributing: number[] = [];
  if (plan.operation === 'correlation') {
    points = rows.flatMap(r => { const x = numberValue(r.values[plan.dimension]), y = numberValue(r.values[plan.metric]); return x === null || y === null ? [] : [{ name: r.id, value: y, x, y, rows: 1, valid: 1 }]; });
    valid = points.length; skipped = rows.length - valid; contributing.push(...points.map(p => p.y!));
    if (valid >= 2) {
      const mx = points.reduce((s, p) => s + p.x!, 0) / valid, my = points.reduce((s, p) => s + p.y!, 0) / valid;
      const vx = points.reduce((s, p) => s + (p.x! - mx) ** 2, 0), vy = points.reduce((s, p) => s + (p.y! - my) ** 2, 0);
      if (vx > 0 && vy > 0) correlation = Math.max(-1, Math.min(1, points.reduce((s, p) => s + (p.x! - mx) * (p.y! - my), 0) / Math.sqrt(vx * vy)));
    }
  } else if (plan.operation === 'distribution') {
    const s = stats(numeric); valid = numeric.length; skipped = rows.length - valid; contributing.push(...numeric);
    if (valid && s.min !== null && s.max !== null) {
      const bins = s.min === s.max ? 1 : Math.min(15, Math.ceil(Math.sqrt(valid))), width = (s.max - s.min) / bins || 1;
      points = Array.from({ length: bins }, (_, i) => ({ name: bins === 1 ? fmt(s.min) : `${fmt(s.min! + i * width)} – ${fmt(s.min! + (i + 1) * width)}`, value: 0, rows: 0, valid: 0 }));
      numeric.forEach(n => { const b = points[Math.min(bins - 1, Math.floor((n - s.min!) / width))]; b.value!++; b.rows++; b.valid++; });
    }
  } else {
    const groups = new Map<string, { name: string; nums: number[]; rows: number }>();
    for (const row of rows) {
      const d = row.values[plan.dimension];
      const date = plan.operation === 'trend' ? isoDate(d) : null;
      if (plan.operation === 'trend' && !date) { skipped++; continue; }
      const name = plan.operation === 'trend' ? date!.slice(0, plan.granularity === 'year' ? 4 : plan.granularity === 'month' ? 7 : 10) : isMissing(d) ? '(غير محدد)' : String(d);
      // Typed keys prevent literal text "(غير محدد)" from merging with missing cells.
      const key = plan.operation === 'trend' ? name : isMissing(d) ? '__missing__' : JSON.stringify([typeof d, d]);
      const group = groups.get(key) ?? { name, nums: [], rows: 0 }; group.rows++;
      const n = numberValue(row.values[plan.metric]);
      if (n !== null) { group.nums.push(n); contributing.push(n); }
      if (plan.aggregation === 'count' || n !== null) valid++; else skipped++;
      groups.set(key, group);
    }
    points = [...groups.values()].map(g => { const s = stats(g.nums); return { name: g.name, rows: g.rows, valid: plan.aggregation === 'count' ? g.rows : s.count, value: plan.aggregation === 'count' ? g.rows : !s.count ? null : s[plan.aggregation] }; });
    points.sort(plan.operation === 'trend' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  }
  const summary = stats(contributing);
  if (points.some(p => p.value !== null && !Number.isFinite(p.value)) || !Number.isFinite(summary.sum) || correlation !== null && !Number.isFinite(correlation)) throw new Error('القيم تتجاوز مجال الحساب الرقمي الآمن. راجع الوحدات أو استخدم أرقامًا أصغر.');
  return { points, rows: rows.length, totalRows: all.length, valid, skipped, summary, correlation, plan };
}

export type CleaningSpec = { operation: 'trim' | 'number' | 'fill' | 'median' | 'replace' | 'duplicates' | 'date_dmy' | 'date_mdy'; column: string; value: string; from: string };
export const cleaningLabels: Record<CleaningSpec['operation'], string> = { trim: 'إزالة المسافات الطرفية', number: 'تحويل الأرقام النصية', fill: 'تعبئة القيم الفارغة', median: 'تعبئة الفارغ بالوسيط', replace: 'استبدال قيمة مطابقة', duplicates: 'إزالة التكرار المطابق بالكامل', date_dmy: 'توحيد تاريخ يوم/شهر/سنة', date_mdy: 'توحيد تاريخ شهر/يوم/سنة' };
export function cleanPreview(sheet: Sheet, spec: CleaningSpec) {
  const column = sheet.columns.find(c => c.id === spec.column);
  if (spec.operation !== 'duplicates' && !column) throw new Error('اختر العمود أولًا.');
  let replacement: Cell = spec.value;
  if (spec.operation === 'fill' || spec.operation === 'replace') {
    if (column!.type === 'number') { replacement = numberValue(spec.value); if (replacement === null) throw new Error('قيمة التعبئة يجب أن تكون رقمًا صالحًا.'); }
    if (column!.type === 'date' && !isoDate(spec.value)) throw new Error('قيمة التاريخ يجب أن تكون YYYY-MM-DD.');
  }
  const median = spec.operation === 'median' ? stats(activeRows(sheet).flatMap(r => { const n = numberValue(r.values[spec.column]); return n === null ? [] : [n]; })).median : null;
  if (spec.operation === 'median' && (column?.type !== 'number' || median === null)) throw new Error('الوسيط يحتاج عمودًا رقميًا بقيم صالحة.');
  const samples: { rowId: string; before: Cell; after: Cell; removed: boolean }[] = [], seen = new Set<string>();
  let affected = 0, invalid = 0;
  const rows = sheet.rows.flatMap(row => {
    if (row.excluded) return [row];
    const before = row.values[spec.column] ?? null; let after = before, removed = false;
    if (spec.operation === 'duplicates') {
      const key = JSON.stringify(sheet.columns.map(c => row.values[c.id] ?? null));
      removed = seen.has(key); seen.add(key);
    } else if (spec.operation === 'trim' && typeof before === 'string') after = before.trim();
    else if (spec.operation === 'number' && !isMissing(before)) { const n = numberValue(before); if (n === null) invalid++; else after = n; }
    else if ((spec.operation === 'fill' || spec.operation === 'median') && isMissing(before)) after = spec.operation === 'median' ? median : replacement;
    else if (spec.operation === 'replace' && String(before ?? '') === spec.from) after = replacement;
    else if (spec.operation.startsWith('date_') && !isMissing(before)) {
      if (isoDate(before)) after = isoDate(before);
      else {
        const m = String(before).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        const date = m ? `${m[3]}-${(spec.operation === 'date_dmy' ? m[2] : m[1]).padStart(2, '0')}-${(spec.operation === 'date_dmy' ? m[1] : m[2]).padStart(2, '0')}` : '';
        if (isoDate(date)) after = date; else invalid++;
      }
    }
    if (removed || before !== after) { affected++; if (samples.length < 12) samples.push({ rowId: row.id, before, after, removed }); }
    return removed ? [] : before !== after ? [{ ...row, values: { ...row.values, [spec.column]: after } }] : [row];
  });
  const type = spec.operation === 'number' ? 'number' : spec.operation.startsWith('date_') ? 'date' : null;
  const columns: Column[] = sheet.columns.map(c => c.id === spec.column && type ? { ...c, type } : c);
  return { sheet: { ...sheet, rows, columns }, affected, invalid, samples, typeChanged: !!type && column?.type !== type, label: `${cleaningLabels[spec.operation]}${column && spec.operation !== 'duplicates' ? `: ${column.name}` : ''}` };
}
export function verification(sheet: Sheet, result: AnalysisResult | null) {
  const profile = inspectSheet(sheet);
  return [
    { name: 'وجود صفوف للتحليل', pass: activeRows(sheet).length > 0, detail: `${activeRows(sheet).length} صف نشط.` },
    { name: 'صلاحية أنواع الأعمدة', pass: profile.counts.invalid === 0, detail: `${profile.counts.invalid} قيمة تخالف النوع المحدد.` },
    { name: 'عدم وجود تكرار كامل', pass: profile.counts.duplicate === 0, detail: `${profile.counts.duplicate} نسخة إضافية مطابقة؛ راجع إن كان التكرار مقصودًا.` },
    { name: 'وجود نتيجة قابلة للحساب', pass: !!result && result.valid > 0, detail: result ? `${result.valid} صف ساهم في النتيجة.` : 'شغّل تحليلًا أولًا.' },
    { name: 'اكتمال مدخلات التحليل الحالي', pass: !!result && result.skipped === 0, detail: result ? `${result.skipped} صف لم يساهم بسبب قيمة رقمية أو تاريخ غير صالح/فارغ.` : 'لا يوجد تحليل.' },
    { name: 'اتساق عدّ الصفوف', pass: !!result && result.valid + result.skipped === result.rows, detail: result ? `${result.valid} مساهم + ${result.skipped} غير مساهم = ${result.rows} بعد التصفية.` : 'لا يوجد تحليل.' },
  ];
}
