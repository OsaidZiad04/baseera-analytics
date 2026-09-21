import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { analyze, cleanPreview, defaultPlan, inspectSheet, validatePlan, verification } from '../lib/baseera/engine';
import { demoProject, makeSheet, newProject, numberValue, parseDelimited, validateProject } from '../lib/baseera/model';
import { csvText, excelBlob, importWorkbook } from '../lib/baseera/io';
import { aiConfig, aiRequestSchema, requestPlan } from '../lib/baseera/ai';
import { HttpError, readJson, sameOrigin } from '../lib/baseera/server-utils';
test('CSV detects delimiter outside quotes and retains commas, multiline cells and leading zeros', () => {
  const grid = parseDelimited('\uFEFF"a,b,c,d";phone;note\r\n4;0077;"one\nline"\r\n5;0088;"He said ""yes"""');
  assert.equal(grid[0].length, 3); assert.equal(grid[1][1], '0077'); assert.equal(grid[1][2], 'one\nline'); assert.equal(grid[2][2], 'He said "yes"');
  assert.throws(() => parseDelimited('a,b\n1,2,3')); assert.throws(() => parseDelimited('a,b\n1,"no'));
});
test('strict numeric conversion handles Arabic notation and rejects ambiguous formats', () => {
  assert.equal(numberValue('١٬٢٣٤٫٥'), 1234.5); assert.equal(numberValue('-70'), -70); assert.equal(numberValue('.5'), .5); assert.equal(numberValue('1,2'), null); assert.equal(numberValue('12 USD'), null); assert.equal(numberValue(''), null); assert.equal(numberValue('1e309'), null);
});
test('CSV export preserves quoted text and guards formulas; Excel retains sheets and typed IDs', async () => {
  const sheet = makeSheet('Sales', [['id', 'value', 'text'], ['001', -12, '=1+1'], ['002', 4, 'a,"b"\nnext']], 0);
  const csv = csvText(sheet), grid = parseDelimited(csv);
  assert.equal(grid.length, 3); assert.equal(grid[1][0], '001'); assert.equal(grid[1][1], '-12'); assert.equal(grid[1][2], "'=1+1"); assert.equal(grid[2][2], 'a,"b"\nnext');
  const project = newProject('export.xlsx', [sheet, makeSheet('sales', [['name'], ['two']], 1)]);
  const blob = await excelBlob(project), roundtrip = await importWorkbook(new File([blob], 'export.xlsx'));
  assert.equal(roundtrip.sheets.length, 2); assert.notEqual(roundtrip.sheets[0].name.toLowerCase(), roundtrip.sheets[1].name.toLowerCase());
  assert.equal(roundtrip.sheets[0].rows[0].values.c0, '001'); assert.equal(roundtrip.sheets[0].rows[0].values.c1, -12); assert.equal(roundtrip.sheets[0].rows[0].values.c2, '=1+1');
});
test('all sheets import, IDs retain zeroes, wider late rows keep columns, duplicate headers are unique', async () => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['phone', 'amount'], ['0077', 15]]), 'First'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name'], ['second']]), 'Second');
  const project = await importWorkbook(new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'test.xlsx'));
  assert.equal(project.sheets.length, 2); assert.equal(project.sheets[0].rows[0].values.c0, '0077'); assert.equal(project.sheets[0].columns[0].type, 'id');
  const sheet = makeSheet('late', [['a'], ...Array.from({ length: 201 }, () => [1]), [2, 3]], 0); assert.equal(sheet.columns.length, 2); assert.equal(sheet.rows.at(-1)!.values.c1, 3);
  const headers = makeSheet('duplicates', [['a', 'a', 'a (2)'], [1, 2, 3]], 0); assert.equal(new Set(headers.columns.map(c => c.name)).size, 3);
});
test('aggregations count valid values; negative values are retained; missing groups are explicit', () => {
  const sheet = makeSheet('sales', [['region', 'sales'], ['A', 10], ['A', 20], ['A', null], ['B', -5], [null, 7]], 0), p = { ...defaultPlan(sheet), metric: 'c1', dimension: 'c0', aggregation: 'average' as const };
  const result = analyze(sheet, p); assert.equal(result.points.find(x => x.name === 'A')?.value, 15); assert.equal(result.valid, 4); assert.equal(result.skipped, 1); assert.equal(result.summary.sum, 32); assert.equal(result.points.find(x => x.name === '(غير محدد)')?.value, 7);
  const count = analyze(sheet, { ...p, aggregation: 'count' }); assert.equal(count.points.find(x => x.name === 'A')?.value, 3); assert.equal(count.skipped, 0);
  const filtered = analyze(sheet, { ...p, aggregation: 'sum', filters: [{ column: 'c1', operator: 'gt', value: '9' }] }); assert.equal(filtered.rows, 2); assert.equal(filtered.summary.sum, 30);
  assert.throws(() => validatePlan(sheet, { ...p, metric: 'unknown' })); assert.throws(() => validatePlan(sheet, { ...p, filters: [{ column: 'c1', operator: 'gt', value: 'bad' }] }));
});
test('zero valid values stay null, more than 24 groups are all calculated, overflow fails visibly', () => {
  const sheet = makeSheet('all', [['name', 'n'], ...Array.from({ length: 50 }, (_, i) => ['N' + i, i])], 0); assert.equal(analyze(sheet, defaultPlan(sheet)).points.length, 50);
  const blank = { ...sheet, rows: sheet.rows.map(r => ({ ...r, values: { ...r.values, c1: null } })) }; assert.equal(analyze(blank, defaultPlan(blank)).points[0].value, null);
  const huge = makeSheet('huge', [['group', 'amount'], ['a', 1e308], ['a', 1e308]], 0); assert.throws(() => analyze(huge, defaultPlan(huge)), /مجال الحساب/);
});
test('trend is chronological and invalid dates do not contribute to its statistics', () => {
  const sheet = makeSheet('trend', [['date', 'amount'], ['2026-02-01', 10], ['2026-01-05', 5], ['2026-02-31', 999]], 0); sheet.columns[0].type = 'date';
  const r = analyze(sheet, { ...defaultPlan(sheet), operation: 'trend', dimension: 'c0', metric: 'c1' }); assert.deepEqual(r.points.map(p => p.name), ['2026-01', '2026-02']); assert.equal(r.skipped, 1); assert.equal(r.summary.sum, 15); assert.equal(r.valid + r.skipped, r.rows);
});
test('distribution bins conserve valid counts; correlation uses complete pairs and constant is undefined', () => {
  const sheet = makeSheet('stats', [['x', 'y'], [1, 2], [2, 4], [3, 6], [null, 8]], 0), p = { ...defaultPlan(sheet), metric: 'c1', dimension: 'c0' };
  const corr = analyze(sheet, { ...p, operation: 'correlation' }); assert.equal(corr.correlation, 1); assert.equal(corr.valid, 3); assert.equal(corr.skipped, 1); assert.equal(corr.summary.sum, 12);
  const dist = analyze(sheet, { ...p, operation: 'distribution' }); assert.equal(dist.points.reduce((n, p) => n + (p.value ?? 0), 0), 4);
  const constant = makeSheet('fixed', [['x', 'y'], [1, 2], [1, 4]], 0); assert.equal(analyze(constant, { ...p, operation: 'correlation' }).correlation, null);
});
test('cleaning previews do not mutate originals; conversion preserves failures and duplicates retain first', () => {
  const sheet = makeSheet('dirty', [['category', 'amount'], [' A ', '12'], ['B', 'oops'], ['B', 'oops'], ['C', null]], 0), before = JSON.stringify(sheet);
  const trim = cleanPreview(sheet, { operation: 'trim', column: 'c0', value: '', from: '' }); assert.equal(trim.affected, 1); assert.equal(trim.sheet.rows[0].values.c0, 'A'); assert.equal(JSON.stringify(sheet), before);
  const numeric = cleanPreview(sheet, { operation: 'number', column: 'c1', value: '', from: '' }); assert.equal(numeric.invalid, 2); assert.equal(numeric.sheet.rows[1].values.c1, 'oops'); assert.equal(inspectSheet(numeric.sheet).counts.invalid, 2);
  const dedup = cleanPreview(sheet, { operation: 'duplicates', column: '', value: '', from: '' }); assert.equal(dedup.affected, 1); assert.equal(dedup.sheet.rows.length, 3); assert.equal(dedup.sheet.originalRows.length, 4);
  const dateSheet = makeSheet('dates', [['date'], ['03/04/2026'], ['31/02/2026']], 0); const dates = cleanPreview(dateSheet, { operation: 'date_dmy', column: 'c0', value: '', from: '' }); assert.equal(dates.sheet.rows[0].values.c0, '2026-04-03'); assert.equal(dates.invalid, 1); assert.equal(dates.sheet.rows[1].values.c0, '31/02/2026');
});
test('real quality checks and project round trip preserve edits and sheets', async () => {
  const project = demoProject(), sheet = project.sheets[0], quality = inspectSheet(sheet); assert.equal(quality.counts.missing, 1); assert.equal(quality.counts.duplicate, 1); assert.equal(quality.counts.negative, 1); assert.equal(quality.counts.spaces, 1);
  assert.equal(verification(sheet, analyze(sheet, defaultPlan(sheet))).find(c => c.name === 'عدم وجود تكرار كامل')?.pass, false);
  project.notes = 'next decision'; const roundtrip = await importWorkbook(new File([JSON.stringify(project)], 'demo.baseera.json')); assert.deepEqual(roundtrip, project);
  assert.throws(() => validateProject({ ...project, activeSheetId: 'bad' }));
  const excessive = makeSheet('wide', [['a', 'b', 'c'], ...Array.from({ length: 84000 }, () => [1, 2, 3])], 0); assert.throws(() => newProject('bad.csv', [excessive]));
});
test('request boundaries reject cross-origin, malformed JSON and oversized streams', async () => {
  assert.throws(() => sameOrigin(new Request('https://baseera.test/api', { headers: { Origin: 'https://evil.test' } })), HttpError);
  await assert.rejects(() => readJson(new Request('https://baseera.test/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }), 20), HttpError);
  await assert.rejects(() => readJson(new Request('https://baseera.test/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"huge":"123456789"}' }), 8), HttpError);
});
const input = aiRequestSchema.parse({ question: 'اجمع المبيعات حسب المنطقة', rowCount: 3, columns: [{ id: 'c0', name: 'region', type: 'category', missing: 0, distinct: 2, min: null, max: null, average: null }, { id: 'c1', name: 'sales', type: 'number', missing: 0, distinct: 3, min: 1, max: 3, average: 2 }] });
const validAnswer = { status: 'plan', message: 'سنحسب المجموع لكل منطقة.', plan: { title: 'المبيعات حسب المنطقة', operation: 'group', metric: 'c1', dimension: 'c0', aggregation: 'sum', granularity: 'month', filters: [] } };
test('provider adapters validate plans, use server key headers and handle both response formats', async () => {
  assert.equal(aiConfig({}), null); assert.equal(aiConfig({ AI_PROVIDER: 'groq', AI_MODEL: 'model' }), null);
  for (const provider of ['gemini', 'groq'] as const) {
    let calls = 0;
    const result = await requestPlan({ provider, key: 'test-only-key', model: 'test-model' }, input, (async (url: unknown, options: RequestInit) => { calls++; assert.ok(String(url).startsWith(provider === 'gemini' ? 'https://generativelanguage.googleapis.com/' : 'https://api.groq.com/')); assert.ok(!String(options.body).includes('test-only-key')); const text = JSON.stringify(validAnswer); return Response.json(provider === 'gemini' ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] } : { choices: [{ finish_reason: 'stop', message: { content: text } }] }); }) as typeof fetch);
    assert.equal(calls, 1); assert.equal(result.plan?.metric, 'c1');
  }
});
test('malicious and unsupported AI output is never executed and provider errors are safe', async () => {
  const config = { provider: 'groq' as const, key: 'secret', model: 'model' };
  for (const content of ['bad JSON', JSON.stringify({ ...validAnswer, plan: { ...validAnswer.plan, metric: 'invented' } }), JSON.stringify({ status: 'plan', message: 'run code', plan: null })]) {
    await assert.rejects(() => requestPlan(config, input, (async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] })) as typeof fetch), /غير صالحة/);
  }
  await assert.rejects(() => requestPlan(config, input, (async () => new Response('provider secret', { status: 429 })) as typeof fetch), /حد الطلبات/);
});

// Regression: leaving before IndexedDB commits used to discard freshly loaded files.
test('navigation awaits durable save, preserves same-tab behavior and blocks failed saves', async () => {
  const { navigate, registerNavigationSave } = await import('../lib/baseera/navigation');
  const calls: string[] = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { href: 'https://baseera.test/lab', origin: 'https://baseera.test', assign: (url: string) => calls.push(url), replace: (url: string) => calls.push('replace:' + url) } } });
  let release!: () => void;
  let unregister = registerNavigationSave(() => new Promise<void>(resolve => { release = resolve; }));
  try {
    const pending = navigate('/lab/profile');
    assert.deepEqual(calls, []);
    await navigate('/lab/report'); // A second click must not race the pending save.
    assert.deepEqual(calls, []);
    release(); await pending;
    assert.deepEqual(calls, ['https://baseera.test/lab/profile']);
    unregister(); unregister = registerNavigationSave(async () => { throw new Error('quota'); });
    await assert.rejects(navigate('/lab/report'), /quota/);
    assert.equal(calls.length, 1);
    unregister(); unregister = registerNavigationSave(async () => {});
    await navigate('/lab/profile', true);
    assert.equal(calls[1], 'replace:https://baseera.test/lab/profile');
    await assert.rejects(navigate('https://other.test/'), /same-origin/);
  } finally { unregister(); if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window'); }
});
