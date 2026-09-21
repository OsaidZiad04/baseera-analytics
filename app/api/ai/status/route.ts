import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { aiConfig } from '@/lib/baseera/ai';
import { json } from '@/lib/baseera/server-utils';
export async function GET() { const config = aiConfig(env), user = await getChatGPTUser(); return json({ configured: !!config, authenticated: !!user, provider: config?.provider ?? null, model: config?.model ?? null }); }
