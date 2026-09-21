import { z } from 'zod';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getStorage } from '@/db';
import { validateProject } from '@/lib/baseera/model';
import { HttpError, json, sameOrigin, serverError } from '@/lib/baseera/server-utils';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try { const user = await getChatGPTUser(); if (!user) throw new HttpError(401, 'سجّل الدخول لفتح مشاريعك.'); const { id } = await context.params; if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, 'معرّف المشروع غير صالح.');
    const { db, bucket } = getStorage(), row = await db.prepare('SELECT object_key, version FROM baseera_projects WHERE id=? AND owner_id=?').bind(id, user.userId).first<{ object_key: string; version: number }>(); if (!row) throw new HttpError(404, 'المشروع غير موجود.');
    const object = await bucket.get(row.object_key); if (!object) throw new HttpError(503, 'تعذر الوصول إلى ملف المشروع. احتفظ بنسختك الحالية وأعد المحاولة.'); return json({ project: validateProject(await object.json()), version: row.version });
  } catch (e) { return serverError(e, 'projects-open'); }
}
export async function DELETE(request: Request, context: Context) {
  try { sameOrigin(request); const user = await getChatGPTUser(); if (!user) throw new HttpError(401, 'سجّل الدخول أولًا.'); const { id } = await context.params; if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, 'معرّف غير صالح.');
    const version = Number(request.headers.get('if-match')); if (!Number.isInteger(version) || version < 1) throw new HttpError(400, 'رقم نسخة المشروع مطلوب للحذف.');
    const { db, bucket } = getStorage();
    const removed = await db.prepare('DELETE FROM baseera_projects WHERE id=? AND owner_id=? AND version=? RETURNING object_key').bind(id, user.userId, version).first<{ object_key: string }>(); if (!removed) throw new HttpError(409, 'المشروع تغيّر أو حُذف. حدّث القائمة قبل الحذف.');
    try { await bucket.delete(removed.object_key); } catch { console.warn('[Baseera:projects-delete] blob cleanup deferred'); } return json({ deleted: true });
  } catch (e) { return serverError(e, 'projects-delete'); }
}
