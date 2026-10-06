export const issuanceStatuses = ['Approved', 'Processing', 'Ready for Issuance', 'Issued'];
export const privateHeaders = { 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff' };

export function pickFields(value: any, fields: string[]) {
  return Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
}
export function selfProfile(user: any) {
  const fields = ['id', 'role', 'first_name', 'middle_name', 'last_name', 'must_change_password'];
  if (user.role === 'student') fields.push('student_id', 'email', 'contact_number', 'address', 'program', 'year_level', 'section');
  return pickFields(user, fields);
}
export function accountSummary(user: any) {
  return pickFields(user, ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'active']);
}
export function requestSummary(request: any, role: string) {
  const result = pickFields(request, ['id', 'application_no', 'reason', 'status', 'submitted_at', 'updated_at', 'date_issued']);
  result.users = role !== 'student' && request.users ? pickFields(request.users, ['first_name', 'last_name', 'student_id']) : null;
  return result;
}
export function identifierFilter(identifier: string) {
  // Quote the filter value and escape LIKE wildcards; identifiers are literal text.
  const literal = identifier.trim().toLowerCase().replace(/[\\%_]/g, '\\$&');
  return ['username', 'email', 'student_id'].map(column => `${column}.ilike.${JSON.stringify(literal)}`).join(',');
}
export function ownsUpload(path: unknown, userId: string, kind: string) {
  if (typeof path !== 'string' || !path.startsWith(userId + '/')) return false;
  const filename = path.slice(userId.length + 1);
  return !filename.includes('..') && new RegExp(`^\\d+-${kind}-[a-zA-Z0-9._-]+$`).test(filename);
}
export function hasFileSignature(bytes: Uint8Array, type: string) {
  if (type === 'application/pdf') return [37, 80, 68, 70, 45].every((b, i) => bytes[i] === b);
  if (type === 'image/jpeg') return [255, 216, 255].every((b, i) => bytes[i] === b);
  if (type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  return false;
}
