import { createClient } from 'npm:@supabase/supabase-js@2';
import { privateHeaders, issuanceStatuses, ownsUpload } from '../_shared/data-security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const allowedOrigins = new Set(['https://rae1124.github.io', 'http://localhost:5173', 'http://localhost:3000']);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://rae1124.github.io',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Vary': 'Origin'
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), ...privateHeaders, 'Content-Type': 'application/json' } });
}
function error(req: Request, message: string, status = 400) {
  return json(req, { error: message }, status);
}
function now() { return new Date().toISOString(); }
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hash].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function authenticate(req: Request) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const tokenHash = await sha256(header.slice(7));
  const { data: session } = await db.from('sessions').select('*').eq('token_hash', tokenHash).is('revoked_at', null).gt('expires_at', now()).maybeSingle();
  if (!session) return null;
  const { data: user } = await db.from('users').select('*').eq('id', session.user_id).eq('active', true).maybeSingle();
  if (!user) return null;
  return user;
}
async function canAccessRequest(user: any, requestId: string) {
  const { data: request } = await db.from('id_requests').select('id,student_user_id,application_no,status').eq('id', requestId).maybeSingle();
  if (!request) return { request: null, allowed: false };
  const staff = ['registrar', 'admin'].includes(user.role) || (user.role === 'idoffice' && issuanceStatuses.includes(request.status));
  return { request, allowed: staff || (user.role === 'student' && request.student_user_id === user.id) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    const user = await authenticate(req);
    if (!user) return error(req, 'Authentication required.', 401);

    if (req.method === 'GET') {
      const requestId = new URL(req.url).searchParams.get('request_id') || '';
      if (!requestId) return error(req, 'Request ID is required.');
      const access = await canAccessRequest(user, requestId);
      if (!access.request) return error(req, 'Application not found.', 404);
      if (!access.allowed) return error(req, 'Access denied.', 403);

      const params = new URL(req.url).searchParams;
      const metadataOnly = params.get('metadata_only') === 'true';
      const documentId = params.get('document_id');
      let documentQuery = db.from('documents').select('id,request_id,kind,file_name,storage_path,content_type,size_bytes,verified,invalid_reason,created_at').eq('request_id', requestId).order('created_at');
      if (documentId) documentQuery = documentQuery.eq('id', documentId);
      const { data: docs, error: docsError } = await documentQuery;
      if (docsError) return error(req, 'Could not load documents.', 500);

      const documents = await Promise.all((docs || []).map(async (doc: any) => {
        const canView = ['document', 'photo'].includes(doc.kind) && ownsUpload(doc.storage_path, access.request.student_user_id, doc.kind);
        const { data, error: signError } = metadataOnly || !canView ? { data: null, error: null } : await db.storage.from('student-id-files').createSignedUrl(doc.storage_path, 120);
        return {
          id: doc.id,
          request_id: doc.request_id,
          kind: doc.kind,
          file_name: doc.file_name,
          content_type: doc.content_type,
          size_bytes: doc.size_bytes,
          verified: doc.verified,
          invalid_reason: doc.invalid_reason || '',
          created_at: doc.created_at,
          can_view: canView,
          ...(metadataOnly ? {} : { view_url: signError ? null : data?.signedUrl || null })
        };
      }));
      return json(req, { application_no: access.request.application_no, documents });
    }

    if (req.method === 'PUT') {
      if (!['registrar', 'admin'].includes(user.role)) return error(req, 'Only Registrar or Administrator may review documents.', 403);
      let body: any = {};
      try { body = await req.json(); } catch { return error(req, 'Invalid request body.'); }
      const documentId = String(body.document_id || '');
      if (!documentId) return error(req, 'Document ID is required.');
      const { data: doc } = await db.from('documents').select('id,request_id,file_name').eq('id', documentId).maybeSingle();
      if (!doc) return error(req, 'Document not found.', 404);
      const access = await canAccessRequest(user, doc.request_id);
      if (!access.allowed) return error(req, 'Access denied.', 403);

      const verified = Boolean(body.verified);
      const invalidReason = verified ? '' : String(body.invalid_reason || '').trim();
      if (!verified && !invalidReason) return error(req, 'Provide a reason when marking a document invalid.');
      const { error: updateError } = await db.from('documents').update({ verified, invalid_reason: invalidReason }).eq('id', documentId);
      if (updateError) return error(req, 'Could not update document review.', 500);
      await db.from('activity_logs').insert({ user_id: user.id, role: user.role, action: 'DOCUMENT_REVIEWED', description: `${verified ? 'Verified' : 'Marked invalid'} document ${doc.file_name}.`, request_id: doc.request_id, application_no: access.request?.application_no || null });
      return json(req, { success: true, verified, invalid_reason: invalidReason });
    }

    return error(req, 'Method not allowed.', 405);
  } catch (e) {
    console.error(e);
    return error(req, 'Internal server error.', 500);
  }
});
