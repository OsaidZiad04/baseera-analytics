import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getRawDb } from '@/db';
import { aiConfig, aiRequestSchema, requestPlan } from '@/lib/baseera/ai';
import { HttpError, json, readJson, sameOrigin, serverError } from '@/lib/baseera/server-utils';
export async function POST(request: Request) {
  try {
    sameOrigin(request); const user = await getChatGPTUser(); if (!user) throw new HttpError(401, 'سجّل الدخول لاستخدام مساعد التحليل.');
    const config = aiConfig(env); if (!config) throw new HttpError(503, 'لم يُربط مزوّد AI بعد. التحليل اليدوي متاح.');
    const parsed = aiRequestSchema.safeParse(await readJson(request, 64000)); if (!parsed.success) throw new HttpError(400, 'السؤال أو وصف الأعمدة غير صالح.');
    if (new Set(parsed.data.columns.map(c => c.id)).size !== parsed.data.columns.length) throw new HttpError(400, 'معرّفات الأعمدة مكررة.');
    const window = Math.floor(Date.now() / 3600000), db = getRawDb();
    const usage = await db.prepare('INSERT INTO baseera_ai_usage (owner_id, window, count) VALUES (?, ?, 1) ON CONFLICT(owner_id) DO UPDATE SET window=excluded.window, count=CASE WHEN baseera_ai_usage.window=excluded.window THEN baseera_ai_usage.count+1 ELSE 1 END WHERE baseera_ai_usage.window<>excluded.window OR baseera_ai_usage.count<20 RETURNING count').bind(user.userId, window).first();
    if (!usage) throw new HttpError(429, 'وصلت إلى حد التجربة: 20 طلب AI في الساعة. يمكنك متابعة التحليل اليدوي.');
    return json(await requestPlan(config, parsed.data));
  } catch (e) { return serverError(e, 'ai-plan'); }
}
