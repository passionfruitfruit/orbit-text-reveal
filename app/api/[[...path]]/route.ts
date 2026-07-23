import { env, waitUntil } from 'cloudflare:workers';
import { animationConfig, platformConfig } from '../../../config.js';
import { dispatchApi, initializeApi } from '../../../server/api.ts';

export const dynamic = 'force-dynamic';

const fallback = { orbit: animationConfig, platforms: platformConfig };

async function handler(request: Request) {
  await initializeApi(env as any);
  return dispatchApi(request, { ...env, waitUntil } as any, fallback);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
