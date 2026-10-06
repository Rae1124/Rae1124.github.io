import { createClient } from 'npm:@supabase/supabase-js@2';
import { privateHeaders, selfProfile, identifierFilter } from '../_shared/data-security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const allowedOrigins = new Set(['https://rae1124.github.io', 'http://localhost:5173', 'http://localhost:3000']);
const staffRoles = new Set(['registrar', 'idoffice', 'admin']);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://rae1124.github.io',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Vary': 'Origin'
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), ...privateHeaders, 'Content-Type': 'application/json' } });
}
function error(req: Request, message: string, status = 400) { return json(req, { error: message }, status); }
function norm(v: unknown) { return String(v ?? '').trim().toLowerCase(); }
function randomHex(n = 32) { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function sha256(value: string) { const bytes = new TextEncoder().encode(value); const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); return [...hash].map(x => x.toString(16).padStart(2, '0')).join(''); }
function b64ToBytes(s: string) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
async function verifyPassword(password: string, encoded: string) {
  try {
    const [scheme, rounds, salt64, hash64] = encoded.split('$');
    if (scheme !== 'pbkdf2') return false;
    const salt = b64ToBytes(salt64), expected = b64ToBytes(hash64);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(rounds) }, key, expected.length * 8));
    if (bits.length !== expected.length) return false;
    let diff = 0; for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}
function publicUser(user: any) { return selfProfile(user); }
async function findUser(identifier: string) {
  const { data } = await db.from('users').select('*').or(identifierFilter(identifier)).limit(1).maybeSingle();
  return data;
}
async function log(user: any, action: string, description: string, req: Request) {
  await db.from('activity_logs').insert({ user_id: user?.id || null, role: user?.role || null, action, description, source_ip: req.headers.get('x-forwarded-for') || '' });
}
async function makeSession(userId: string, remember: boolean) {
  const token = randomHex(32);
  const expires = new Date(Date.now() + (remember ? 7 * 864e5 : 8 * 36e5)).toISOString();
  const { error } = await db.from('sessions').insert({ user_id: userId, token_hash: await sha256(token), expires_at: expires });
  if (error) throw Error('Session creation failed.');
  return { token, expires_at: expires };
}
async function verifyTurnstile(token: string, req: Request) {
  if (!TURNSTILE_SECRET_KEY) return { ok: false, configuration: true };
  const form = new URLSearchParams();
  form.set('secret', TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const remoteIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (remoteIp) form.set('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  const result: any = await response.json();
  const ok = Boolean(result.success) && result.hostname === 'rae1124.github.io' && result.action === 'staff_login';
  return { ok, result };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return error(req, 'Method not allowed.', 405);
  try {
    let body: any = {};
    try { body = await req.json(); } catch { return error(req, 'Invalid request body.'); }
    const portal = String(body.portal || '');
    const identifier = String(body.identifier || '').trim();
    const password = String(body.password || '');
    const captchaToken = String(body.captchaToken || '');
    if (portal && !staffRoles.has(portal)) return error(req, 'Staff CAPTCHA login is only available for authorized staff portals.', 400);
    if (!identifier || !password) return error(req, 'Enter your login ID and password.');
    if (!captchaToken) {
      await log(null, 'CAPTCHA_FAILED', `Missing staff CAPTCHA token for ${portal} portal.`, req);
      return error(req, 'Complete the human verification before logging in.', 400);
    }
    const captcha = await verifyTurnstile(captchaToken, req);
    if ((captcha as any).configuration) return error(req, 'Staff security verification is not configured.', 503);
    if (!captcha.ok) {
      await log(null, 'CAPTCHA_FAILED', `Staff CAPTCHA verification failed for ${portal} portal.`, req);
      return error(req, 'Human verification failed or expired. Please verify again.', 403);
    }
    await log(null, 'CAPTCHA_PASSED', `Staff CAPTCHA verification passed for ${portal} portal.`, req);
    const user = await findUser(identifier);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await log(null, 'LOGIN_FAILED', `Failed staff login for ${portal} portal.`, req);
      return error(req, 'Invalid credentials.', 401);
    }
    if (!user.active) return error(req, 'This account is inactive. Contact an Administrator.', 403);
    if (!staffRoles.has(user.role) || (portal && user.role !== portal)) return error(req, 'Access denied for this account.', 403);
    const session = await makeSession(user.id, Boolean(body.remember));
    await log(user, 'LOGIN_SUCCESS', `Signed in to ${user.role} portal after CAPTCHA verification.`, req);
    return json(req, { user: publicUser(user), ...session });
  } catch (e) {
    console.error(e);
    return error(req, 'Internal server error.', 500);
  }
});
