import { z } from 'zod';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getStorage } from '@/db';
import { MAX_PROJECT_BYTES, projectSchema } from '@/lib/baseera/model';
import { HttpError, json, readJson, sameOrigin, serverError } from '@/lib/baseera/server-utils';
export async function GET() {
  try { const user = await getChatGPTUser(); if (!user) throw new HttpError(401, 'سجّل الدخول لحفظ مشاريعك وفتحها.'); const { db } = getStorage(); const data = await db.prepare('SELECT id, name, file_name AS fileName, version, revision, rows, sheets, updated_at AS updatedAt FROM baseera_projects WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 100').bind(user.userId).all(); return json({ projects: data.results }); } catch (e) { return serverError(e, 'projects-list'); }
}
export async function POST(request: Request) {
  let stagedKey: string | undefined;
  try {
    sameOrigin(request); const user = await getChatGPTUser(); if (!user) throw new HttpError(401, 'سجّل الدخول للحفظ السحابي. مسودتك محفوظة على هذا الجهاز.');
    const body = z.object({ project: projectSchema, expectedVersion: z.number().int().positive().nullable() }).safeParse(await readJson(request, MAX_PROJECT_BYTES + 4096));
    if (!body.success) throw new HttpError(400, 'نسخة المشروع غير صالحة أو تتجاوز حدود الحجم.');
    const { project: p, expectedVersion } = body.data, { db, bucket } = getStorage(), serialized = JSON.stringify(p), bytes = new TextEncoder().encode(serialized).byteLength;
    if (bytes > MAX_PROJECT_BYTES) throw new HttpError(413, 'حجم المشروع أكبر من 12 MB؛ صدّر ملف Excel أو CSV.');
    const existing = await db.prepare('SELECT owner_id, version, object_key FROM baseera_projects WHERE id = ?').bind(p.id).first<{ owner_id: string; version: number; object_key: string }>();
    if (existing && existing.owner_id !== user.userId) throw new HttpError(404, 'المشروع غير موجود.');
    if (existing && expectedVersion !== existing.version) throw new HttpError(409, 'توجد نسخة محفوظة أحدث أو لم تفتح النسخة السحابية. صدّر تعديلاتك أولًا، ثم افتح المشروع من «مشاريعي» للمقارنة.');
    if (!existing && expectedVersion !== null) throw new HttpError(409, 'المشروع المحفوظ لم يعد موجودًا. صدّر نسخة مشروع قبل المتابعة.');
    if (!existing) { const count = await db.prepare('SELECT COUNT(*) AS n FROM baseera_projects WHERE owner_id = ?').bind(user.userId).first<{ n: number }>(); if ((count?.n ?? 0) >= 100) throw new HttpError(409, 'بلغت حد 100 مشروع. احذف مشروعًا قديمًا بعد تصديره.'); }
    const now = new Date().toISOString(), version = (existing?.version ?? 0) + 1, key = `projects/${p.id}/${crypto.randomUUID()}.json`;
    await bucket.put(key, serialized, { httpMetadata: { contentType: 'application/json' } }); stagedKey = key;
    const rows = p.sheets.reduce((n, s) => n + s.rows.length, 0);
    const written = existing ? await db.prepare('UPDATE baseera_projects SET name=?, file_name=?, object_key=?, version=?, revision=?, rows=?, sheets=?, bytes=?, updated_at=? WHERE id=? AND owner_id=? AND version=?').bind(p.name, p.fileName, key, version, p.revision, rows, p.sheets.length, bytes, now, p.id, user.userId, existing.version).run() : await db.prepare('INSERT INTO baseera_projects (id, owner_id, name, file_name, object_key, version, revision, rows, sheets, bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(p.id, user.userId, p.name, p.fileName, key, version, p.revision, rows, p.sheets.length, bytes, now, now).run();
    if (!written.meta.changes) { await bucket.delete(key); stagedKey = undefined; throw new HttpError(409, 'تغيّرت النسخة أثناء الحفظ. صدّر تعديلاتك ثم افتح أحدث نسخة.'); }
    stagedKey = undefined;
    if (existing) { try { await bucket.delete(existing.object_key); } catch { console.warn('[Baseera:projects-save] old object cleanup deferred'); } }
    return json({ version, updatedAt: now });
  } catch (e) { if (stagedKey) { try { await getStorage().bucket.delete(stagedKey); } catch {} } return serverError(e, 'projects-save'); }
}
