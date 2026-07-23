const SESSION_COOKIE = 'admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function digest(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function equalText(left: string, right: string) {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function verifyAdminPassword(input: string, configured: string) {
  if (!configured || !input) return false;
  const [inputDigest, configuredDigest] = await Promise.all([digest(input), digest(configured)]);
  return equalText(inputDigest, configuredDigest);
}

export function serializeSessionCookie(token: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function serializeExpiredSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function parseSessionToken(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function createSession(db: D1Database, now = Date.now()) {
  const token = randomToken();
  const tokenDigest = await digest(token);
  const expiresAt = now + SESSION_SECONDS * 1000;
  await db.prepare('INSERT INTO admin_sessions (token_digest, created_at, expires_at, revoked_at) VALUES (?, ?, ?, NULL)')
    .bind(tokenDigest, now, expiresAt).run();
  return { token, tokenDigest, expiresAt, cookie: serializeSessionCookie(token) };
}

export async function requireAdmin(request: Request, db: D1Database, now = Date.now()) {
  const token = parseSessionToken(request);
  if (!token) return false;
  const tokenDigest = await digest(token);
  await db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now).run();
  const session = await db.prepare('SELECT token_digest FROM admin_sessions WHERE token_digest = ? AND revoked_at IS NULL AND expires_at > ?')
    .bind(tokenDigest, now).first();
  return Boolean(session);
}

export async function revokeSession(request: Request, db: D1Database, now = Date.now()) {
  const token = parseSessionToken(request);
  if (!token) return;
  await db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE token_digest = ?')
    .bind(now, await digest(token)).run();
}

export async function checkSubmissionLimit(
  db: D1Database,
  request: Request,
  kind: string,
  salt: string,
  { now = Date.now(), windowMs = 10 * 60 * 1000, maximum = 5 } = {},
) {
  const address = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const keyDigest = await digest(`${salt}:${address}`);
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const result = await db.prepare(`
    INSERT INTO submission_limits (key_digest, kind, window_start, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(key_digest, kind, window_start) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(keyDigest, kind, windowStart).first<{ count: number }>();
  return (result?.count ?? maximum + 1) <= maximum;
}
