import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendStatusEmail } from '../_shared/status-email.ts';
import {
  privateHeaders,
  selfProfile,
  accountSummary,
  requestSummary,
  identifierFilter,
  issuanceStatuses,
  ownsUpload,
  hasFileSignature,
} from '../_shared/data-security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const allowedOrigins = new Set([
  'https://rae1124.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
]);
const roles = ['student', 'registrar', 'idoffice', 'admin'];
const staffRoles = ['registrar', 'idoffice', 'admin'];

function cors(req: Request) {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(o) ? o : 'https://rae1124.github.io',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    Vary: 'Origin',
  };
}
function j(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), ...privateHeaders, 'Content-Type': 'application/json' },
  });
}
function err(req: Request, message: string, status = 400) {
  return j(req, { error: message }, status);
}
function pathOf(req: Request) {
  const p = new URL(req.url).pathname;
  const i = p.indexOf('/id-system-api');
  return i >= 0 ? p.slice(i + '/id-system-api'.length) || '/' : p;
}
function norm(v: unknown) {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}
function now() {
  return new Date().toISOString();
}
function bytesToB64(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function randomHex(n = 32) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function sha256(s: string) {
  const b = new TextEncoder().encode(s);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  return [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function passwordIssue(p: string) {
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p))
    return 'Password must contain uppercase, lowercase, and a number.';
  return '';
}
async function hashPassword(p: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210000 },
    key,
    256,
  );
  return `pbkdf2$210000$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}
async function verifyPassword(p: string, e: string) {
  try {
    const [scheme, rounds, salt64, hash64] = e.split('$');
    if (scheme !== 'pbkdf2') return false;
    const salt = b64ToBytes(salt64),
      expected = b64ToBytes(hash64);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, [
      'deriveBits',
    ]);
    const bits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(rounds) },
        key,
        expected.length * 8,
      ),
    );
    if (bits.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
function publicUser(u: any) {
  return selfProfile(u);
}
async function findUser(identifier: string) {
  const { data } = await db
    .from('users')
    .select('*')
    .or(identifierFilter(identifier))
    .limit(1)
    .maybeSingle();
  return data;
}
async function auth(req: Request, allowed?: string[]) {
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  const tokenHash = await sha256(token);
  const { data: s } = await db
    .from('sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now())
    .maybeSingle();
  if (!s) return null;
  const { data: u } = await db
    .from('users')
    .select('*')
    .eq('id', s.user_id)
    .eq('active', true)
    .maybeSingle();
  if (!u || !roles.includes(u.role) || (allowed && !allowed.includes(u.role))) return null;
  await db.from('sessions').update({ last_seen_at: now() }).eq('id', s.id);
  return { user: u, session: s, token };
}
async function log(
  user: any,
  action: string,
  description: string,
  req: Request,
  applicationNo?: string,
  requestId?: string,
) {
  await db.from('activity_logs').insert({
    user_id: user?.id || null,
    role: user?.role || null,
    action,
    description,
    application_no: applicationNo || null,
    request_id: requestId || null,
    source_ip: req.headers.get('x-forwarded-for') || '',
  });
}
async function makeSession(userId: string, remember: boolean) {
  const token = randomHex(32);
  const expires = new Date(Date.now() + (remember ? 7 * 864e5 : 8 * 36e5)).toISOString();
  const { error } = await db
    .from('sessions')
    .insert({ user_id: userId, token_hash: await sha256(token), expires_at: expires });
  if (error) throw Error('Session creation failed.');
  return { token, expires_at: expires };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const path = pathOf(req);
  let body: any = {};
  if (!['GET', 'HEAD'].includes(req.method)) {
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 8000000) return err(req, 'Request body too large.', 413);
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  try {
    if (path === '/health' && req.method === 'GET') return j(req, { ok: true });
    if (path === '/auth/setup-status' && req.method === 'GET') {
      const { count } = await db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      return j(req, { adminExists: (count || 0) > 0 });
    }
    if (path === '/auth/setup-admin' && req.method === 'POST') {
      const { count } = await db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if ((count || 0) > 0)
        return err(req, 'The initial Administrator has already been created.', 409);
      const first = String(body.firstName || '').trim(),
        middle = String(body.middleName || '').trim(),
        last = String(body.lastName || '').trim(),
        username = norm(body.username),
        email = norm(body.email),
        password = String(body.password || '');
      if (!first || !last || !username || !email.includes('@'))
        return err(req, 'Complete the Administrator name, username, and email.');
      const pe = passwordIssue(password);
      if (pe) return err(req, pe);
      const { data: u, error: e } = await db
        .from('users')
        .insert({
          username,
          email,
          first_name: first,
          middle_name: middle,
          last_name: last,
          password_hash: await hashPassword(password),
          role: 'admin',
          active: true,
          must_change_password: false,
        })
        .select('*')
        .single();
      if (e)
        return err(
          req,
          e.code === '23505'
            ? 'That username or email is already registered.'
            : 'Could not create Administrator.',
          e.code === '23505' ? 409 : 500,
        );
      await log(u, 'INITIAL_ADMIN_CREATED', 'Initial Administrator account created.', req);
      return j(req, { message: 'Initial Administrator created.' }, 201);
    }
    if (path === '/auth/register-student' && req.method === 'POST') {
      const studentId = String(body.studentId || '').trim(),
        first = String(body.firstName || '').trim(),
        middle = String(body.middleName || '').trim(),
        last = String(body.lastName || '').trim(),
        email = norm(body.email),
        password = String(body.password || ''),
        program = String(body.program || '').trim(),
        year = String(body.yearLevel || '').trim(),
        section = String(body.section || '').trim();
      if (!studentId || !first || !last || !email.includes('@') || !program || !year || !section)
        return err(req, 'Complete all required student profile fields.');
      if (Deno.env.get('ALLOW_UNVERIFIED_STUDENT_REGISTRATION') !== 'true')
        return err(req, 'Student registration requires school verification. Contact the Registrar.', 403);
      if ([studentId, first, middle, last, email, program, year, section].some((v) => v.length > 255))
        return err(req, 'A registration field exceeds the maximum length.', 400);
      const pe = passwordIssue(password);
      if (pe) return err(req, pe);
      const { data: u, error: e } = await db
        .from('users')
        .insert({
          username: studentId,
          email,
          first_name: first,
          middle_name: middle,
          last_name: last,
          password_hash: await hashPassword(password),
          role: 'student',
          active: true,
          must_change_password: false,
          student_id: studentId,
          contact_number: String(body.contactNumber || ''),
          address: String(body.address || ''),
          program,
          year_level: year,
          section,
        })
        .select('*')
        .single();
      if (e)
        return err(
          req,
          e.code === '23505'
            ? 'Student ID or email is already registered.'
            : 'Could not create student profile.',
          e.code === '23505' ? 409 : 500,
        );
      await log(u, 'STUDENT_REGISTERED', `Student profile ${studentId} created.`, req);
      return j(req, { message: 'Student profile created successfully.' }, 201);
    }
    if (path === '/auth/login' && req.method === 'POST') {
      const portal = String(body.portal || ''),
        identifier = String(body.identifier || '').trim(),
        password = String(body.password || '');
      if ((portal && !roles.includes(portal)) || !identifier || !password)
        return err(req, 'Enter your login ID and password.');
      const u = await findUser(identifier);
      if (!u || !(await verifyPassword(password, u.password_hash))) {
        await log(null, 'LOGIN_FAILED', 'Failed login attempt.', req);
        return err(req, 'Invalid credentials.', 401);
      }
      if (!u.active) return err(req, 'This account is inactive. Contact an Administrator.', 403);
      if (!roles.includes(u.role) || (portal && u.role !== portal))
        return err(req, 'Access denied for this account.', 403);
      // The stored role is authoritative. No staff session is issued before CAPTCHA.
      if (staffRoles.includes(u.role)) return j(req, { requiresCaptcha: true });
      const session = await makeSession(u.id, Boolean(body.remember));
      await log(u, 'LOGIN_SUCCESS', `Signed in to ${u.role} portal.`, req);
      return j(req, { user: publicUser(u), ...session });
    }
    if (path === '/auth/me' && req.method === 'GET') {
      const a = await auth(req);
      if (!a) return err(req, 'Authentication required.', 401);
      return j(req, { user: publicUser(a.user) });
    }
    if (path === '/auth/logout' && req.method === 'POST') {
      const a = await auth(req);
      if (a) {
        await db.from('sessions').update({ revoked_at: now() }).eq('id', a.session.id);
        await log(a.user, 'LOGOUT', 'User signed out.', req);
      }
      return j(req, { success: true });
    }
    if (path === '/auth/change-password' && req.method === 'POST') {
      const a = await auth(req);
      if (!a) return err(req, 'Authentication required.', 401);
      const current = String(body.currentPassword || ''),
        next = String(body.newPassword || '');
      if (!(await verifyPassword(current, a.user.password_hash)))
        return err(req, 'Current password is incorrect.');
      const pe = passwordIssue(next);
      if (pe) return err(req, pe);
      await db
        .from('users')
        .update({
          password_hash: await hashPassword(next),
          must_change_password: false,
          updated_at: now(),
        })
        .eq('id', a.user.id);
      await db
        .from('sessions')
        .update({ revoked_at: now() })
        .eq('user_id', a.user.id)
        .neq('id', a.session.id);
      await log(a.user, 'PASSWORD_CHANGED', 'Password changed.', req);
      return j(req, { message: 'Password changed successfully.' });
    }
    if (path === '/users' && req.method === 'GET') {
      const a = await auth(req, ['admin']);
      if (!a) return err(req, 'Access denied.', 403);
      const { data } = await db
        .from('users')
        .select('id,username,email,first_name,last_name,role,active')
        .order('created_at', { ascending: false });
      return j(req, { users: (data || []).map(accountSummary) });
    }
    if (path === '/users/staff' && req.method === 'POST') {
      const a = await auth(req, ['admin']);
      if (!a) return err(req, 'Access denied.', 403);
      const role = String(body.role || '');
      if (!staffRoles.includes(role)) return err(req, 'Choose a valid staff role.');
      const first = String(body.firstName || '').trim(),
        middle = String(body.middleName || '').trim(),
        last = String(body.lastName || '').trim(),
        username = norm(body.username),
        email = norm(body.email),
        password = String(body.temporaryPassword || '');
      if (!first || !last || !username || !email.includes('@'))
        return err(req, 'Complete the staff account fields.');
      const pe = passwordIssue(password);
      if (pe) return err(req, pe);
      const { data: u, error: e } = await db
        .from('users')
        .insert({
          username,
          email,
          first_name: first,
          middle_name: middle,
          last_name: last,
          password_hash: await hashPassword(password),
          role,
          active: true,
          must_change_password: true,
        })
        .select('*')
        .single();
      if (e)
        return err(
          req,
          e.code === '23505'
            ? 'Username or email already exists.'
            : 'Could not create staff account.',
          e.code === '23505' ? 409 : 500,
        );
      await log(
        a.user,
        'STAFF_ACCOUNT_CREATED',
        `Created ${role} account for ${first} ${last}.`,
        req,
      );
      return j(req, { user: accountSummary(u) }, 201);
    }
    if (path.startsWith('/users/') && path.endsWith('/reset-password') && req.method === 'POST') {
      const a = await auth(req, ['admin']);
      if (!a) return err(req, 'Access denied.', 403);
      const id = path.split('/')[2],
        password = String(body.temporaryPassword || '');
      const pe = passwordIssue(password);
      if (pe) return err(req, pe);
      await db
        .from('users')
        .update({
          password_hash: await hashPassword(password),
          must_change_password: true,
          updated_at: now(),
        })
        .eq('id', id);
      await db.from('sessions').update({ revoked_at: now() }).eq('user_id', id);
      await log(a.user, 'ADMIN_PASSWORD_RESET', `Reset password for user ${id}.`, req);
      return j(req, { message: 'Temporary password saved.' });
    }
    if (path.startsWith('/users/') && req.method === 'PUT') {
      const a = await auth(req, ['admin']);
      if (!a) return err(req, 'Access denied.', 403);
      const id = path.split('/')[2];
      const updates: any = { updated_at: now() };
      if (typeof body.active === 'boolean') updates.active = body.active;
      if (body.role !== undefined) {
        if (!roles.includes(body.role)) return err(req, 'Invalid user role.', 400);
        updates.role = body.role;
      }
      if (id === a.user.id && (updates.active === false || (updates.role && updates.role !== 'admin')))
        return err(req, 'You cannot remove your own administrator access.', 409);
      await db.from('users').update(updates).eq('id', id);
      if (body.active === false || (updates.role && updates.role !== a.user.role))
        await db.from('sessions').update({ revoked_at: now() }).eq('user_id', id);
      await log(a.user, 'USER_ACCESS_UPDATED', `Updated user ${id}.`, req);
      return j(req, { success: true });
    }
    if (path === '/activity-logs' && req.method === 'GET') {
      const a = await auth(req, ['admin']);
      if (!a) return err(req, 'Access denied.', 403);
      const { data } = await db
        .from('activity_logs')
        .select('created_at,role,action,description')
        .order('created_at', { ascending: false })
        .limit(250);
      return j(req, { logs: data || [] });
    }
    if (path === '/files' && req.method === 'POST') {
      const a = await auth(req, ['student']);
      if (!a) return err(req, 'Access denied.', 403);
      const filename = String(body.filename || ''),
        contentType = String(body.contentType || ''),
        base64 = String(body.base64 || ''),
        kind = String(body.kind || '');
      if (
        !filename ||
        !base64 ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(contentType) ||
        !['document', 'photo'].includes(kind)
      )
        return err(req, 'Invalid file upload.');
      const raw = base64.includes(',') ? base64.split(',').pop()! : base64;
      let bytes: Uint8Array;
      try {
        bytes = b64ToBytes(raw);
      } catch {
        return err(req, 'Invalid file data.');
      }
      if (
        !hasFileSignature(bytes, contentType) ||
        (kind === 'photo' && !['image/jpeg', 'image/png'].includes(contentType))
      )
        return err(req, 'The file contents do not match the required file type.');
      if (bytes.length === 0 || bytes.length > 5242880)
        return err(req, 'File must be between 1 byte and 5 MB.');
      const safe = filename.slice(0, 120).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${a.user.id}/${Date.now()}-${kind}-${safe}`;
      const { error: e } = await db.storage
        .from('student-id-files')
        .upload(storagePath, bytes, { contentType, upsert: false });
      if (e) return err(req, 'File upload failed.', 500);
      return j(req, { path: storagePath, name: filename, size: bytes.length, contentType });
    }
    if (path === '/requests' && req.method === 'POST') {
      const a = await auth(req, ['student']);
      if (!a) return err(req, 'Access denied.', 403);
      if (
        !['Lost ID', 'Damaged ID'].includes(body.reason) ||
        String(body.description || '').trim().length < 10 ||
        String(body.description || '').length > 2000
      )
        return err(req, 'Reason and description are required.');
      const uploaded = [];
      for (const [kind, file] of [
        ['document', body.document],
        ['photo', body.photo],
      ] as const) {
        if (!file || file.kind !== kind) return err(req, 'Upload both required files.');
        if (!ownsUpload(file.path, a.user.id, kind))
          return err(req, 'You may only attach your own uploaded files.', 403);
        const { data: info, error: infoError } = await db.storage
          .from('student-id-files')
          .info(file.path);
        if (infoError || !info)
          return err(req, 'The uploaded file could not be verified. Upload it again.');
        const type = info.contentType;
        const size = Number(info.size);
        if (
          !Number.isFinite(size) ||
          size <= 0 ||
          size > 5242880 ||
          !['application/pdf', 'image/jpeg', 'image/png'].includes(type || '') ||
          (kind === 'photo' && type === 'application/pdf')
        )
          return err(req, 'Invalid uploaded file.');
        uploaded.push({
          kind,
          path: file.path,
          name: String(file.name || 'file').slice(0, 255),
          size,
          contentType: type,
        });
      }
      const { data: no } = await db.rpc('next_application_no');
      const { data: r, error: e } = await db
        .from('id_requests')
        .insert({
          application_no: no,
          student_user_id: a.user.id,
          reason: body.reason,
          description: String(body.description).trim(),
          status: 'Submitted',
        })
        .select('*')
        .single();
      if (e) return err(req, 'Could not create application.', 500);
      for (const f of uploaded) {
        await db.from('documents').insert({
          request_id: r.id,
          owner_user_id: a.user.id,
          kind: f.kind,
          file_name: f.name,
          storage_path: f.path,
          content_type: f.contentType,
          size_bytes: f.size,
        });
      }
      await db.from('application_status_history').insert({
        request_id: r.id,
        status: 'Submitted',
        remarks: 'Application submitted successfully.',
        actor_user_id: a.user.id,
        actor_role: 'student',
      });
      await db.from('notifications').insert({
        user_id: a.user.id,
        request_id: r.id,
        title: 'Application Submitted',
        message: `${no} was submitted successfully.`,
      });
      await log(
        a.user,
        'APPLICATION_SUBMITTED',
        `Submitted ${body.reason} request.`,
        req,
        no,
        r.id,
      );
      return j(req, { request: requestSummary(r, a.user.role) }, 201);
    }
    if (path === '/requests' && req.method === 'GET') {
      const a = await auth(req);
      if (!a) return err(req, 'Authentication required.', 401);
      let q = db
        .from('id_requests')
        .select(
          'id,application_no,reason,status,submitted_at,updated_at,date_issued,users!id_requests_student_user_id_fkey(student_id,first_name,last_name)',
        )
        .order('submitted_at', { ascending: false });
      if (a.user.role === 'student') q = q.eq('student_user_id', a.user.id);
      if (a.user.role === 'idoffice') q = q.in('status', issuanceStatuses);
      const { data, error } = await q;
      if (error) return err(req, 'Could not load applications.', 500);
      return j(req, { requests: (data || []).map((r) => requestSummary(r, a.user.role)) });
    }
    if (path.startsWith('/requests/') && path.endsWith('/status') && req.method === 'PUT') {
      const a = await auth(req, ['registrar', 'idoffice', 'admin']);
      if (!a) return err(req, 'Access denied.', 403);
      const id = path.split('/')[2];
      const { data: r } = await db.from('id_requests').select('*').eq('id', id).maybeSingle();
      if (!r) return err(req, 'Application not found.', 404);
      const s = String(body.status || ''),
        remarks = String(body.remarks || s).trim().slice(0, 2000);
      const validStatuses = [
        'Submitted', 'Under Review', 'Documents Required', 'Approved', 'Rejected',
        'Processing', 'Ready for Issuance', 'Issued', 'Cancelled',
      ];
      if (!validStatuses.includes(s)) return err(req, 'Invalid application status.', 400);
      if (s === r.status) return j(req, { success: true });
      if (a.user.role === 'registrar') {
        const valid =
          (s === 'Under Review' && r.status === 'Submitted') ||
          (s === 'Documents Required' && ['Submitted', 'Under Review'].includes(r.status)) ||
          (['Approved', 'Rejected'].includes(s) &&
            ['Under Review', 'Documents Required'].includes(r.status));
        if (!valid) return err(req, 'Registrar status transition not allowed.', 409);
      }
      if (a.user.role === 'idoffice') {
        const valid =
          (s === 'Processing' && r.status === 'Approved') ||
          (s === 'Ready for Issuance' && r.status === 'Processing') ||
          (s === 'Issued' && r.status === 'Ready for Issuance');
        if (!valid) return err(req, 'ID Office status transition not allowed.', 409);
      }
      const { data: notificationId, error: statusError } = await db.rpc(
        'update_request_status_with_notification',
        {
          target_request_id: id,
          expected_status: r.status,
          next_status: s,
          actor_id: a.user.id,
          status_remarks: remarks,
        },
      );
      if (statusError)
        return err(
          req,
          statusError.code === '40001'
            ? 'The application changed. Refresh and try again.'
            : 'Could not update application.',
          statusError.code === '40001' ? 409 : 500,
        );
      await log(
        a.user,
        'APPLICATION_STATUS_CHANGED',
        `Changed status to ${s}.`,
        req,
        r.application_no,
        id,
      );
      const email = notificationId
        ? await sendStatusEmail(db, notificationId)
        : { status: 'not_requested' };
      return j(req, { success: true, email });
    }
    if (/^\/notifications\/[^/]+\/retry-email$/.test(path) && req.method === 'POST') {
      const a = await auth(req, ['admin']);
      if (!a) return err(req, 'Access denied.', 403);
      const email = await sendStatusEmail(db, path.split('/')[2]);
      return j(req, { email }, email.status === 'not_found' ? 404 : 200);
    }
    if (path === '/notices' && req.method === 'GET') {
      const a = await auth(req);
      if (!a) return err(req, 'Authentication required.', 401);
      const { data } = await db
        .from('notifications')
        .select('id,title,message,created_at')
        .eq('user_id', a.user.id)
        .order('created_at', { ascending: false });
      return j(req, { notices: data || [] });
    }
    return err(req, 'Not found', 404);
  } catch (e) {
    console.error(e);
    return err(req, 'Internal server error', 500);
  }
});
