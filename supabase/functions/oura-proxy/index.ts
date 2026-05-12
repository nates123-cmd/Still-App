// Supabase Edge Function: oura-proxy
// Forwards GET requests to api.ouraring.com using the Oura PAT supplied
// in the x-oura-pat request header. Path is whitelisted to safe endpoints.
//
// Deploy via dashboard (uncheck "Verify JWT") or CLI:
//   supabase functions deploy oura-proxy --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-oura-pat, apikey',
  'Access-Control-Max-Age': '86400',
};

const ALLOWED_PATHS = new Set([
  'personal_info',
  'daily_sleep',
  'daily_readiness',
  'daily_activity',
  'sleep',
  'heartrate',
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const pat = req.headers.get('x-oura-pat');
    if (!pat) return json({ error: 'Missing x-oura-pat header' }, 400);

    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    if (!path || !ALLOWED_PATHS.has(path)) {
      return json({ error: 'Missing or disallowed path' }, 400);
    }

    const target = new URL(`https://api.ouraring.com/v2/usercollection/${path}`);
    for (const k of ['start_date', 'end_date', 'start_datetime', 'end_datetime']) {
      const v = url.searchParams.get(k);
      if (v) target.searchParams.set(k, v);
    }

    const ouraRes = await fetch(target.toString(), {
      headers: { Authorization: `Bearer ${pat}` },
    });

    const text = await ouraRes.text();
    return new Response(text, {
      status: ouraRes.status,
      headers: { 'content-type': 'application/json', ...CORS },
    });
  },
};
