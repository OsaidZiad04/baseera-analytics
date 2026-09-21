export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'الطلب من مصدر غير مسموح.');
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'الطلب من مصدر غير مسموح.');
}
export async function readJson(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'نوع الطلب يجب أن يكون JSON.');
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new HttpError(413, 'حجم الطلب أكبر من الحد المسموح.');
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, 'الطلب فارغ.');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new HttpError(413, 'حجم الطلب أكبر من الحد المسموح.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(400, 'JSON غير صالح.'); }
}
export function serverError(error: unknown, scope: string) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Do not log project data, provider response bodies, prompts or keys.
  console.error(`[Baseera:${scope}] request failed`, error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'الخدمة غير متاحة الآن. احتفظ بالمسودة أو صدّر نسخة مشروع، ثم أعد المحاولة.' }, 503);
}
