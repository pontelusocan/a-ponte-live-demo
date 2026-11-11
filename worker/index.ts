import {ApiError, boundedBody, jpegDimensions, stripJpegMetadata, MAX_BODY_BYTES, MAX_IMAGE_BYTES} from './image.ts';

import {cleanMemberTokens, currentMember, memberApi} from './members.ts';

type Row = {member_id?: string | null; id: string; request_hash: string; object_key: string; processing_state: string; created_at: string; expires_at: string};
type Statement = {
  bind(...args: unknown[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{results: T[]}>;
  run(): Promise<{meta: {changes: number}}>;
};
type ObjectHead = {size: number; customMetadata?: Record<string, string>};
export type Env = {
  DB: {prepare(sql: string): Statement; batch(statements: Statement[]): Promise<Array<{meta: {changes: number}}>>};
  REVIEW_DB: Env['DB'];
  MEMBER_LIMITER: Env['UPLOAD_LIMITER'];
  MEMBERS_ENABLED?: string;
  RESEND_API_KEY?: string;
  MEMBER_EMAIL_FROM?: string;
  PHOTOS: {
    get(key: string): Promise<{body: ReadableStream} | null>;
    put(key: string, data: Uint8Array, options: unknown): Promise<unknown>;
    head(key: string): Promise<ObjectHead | null>;
    delete(key: string): Promise<void>;
  };
  IMAGES: {input(stream: ReadableStream<Uint8Array>): {
    transform(options: unknown): {output(options: unknown): Promise<{response(): Response}>};
  }};
  UPLOAD_LIMITER: {limit(options: {key: string}): Promise<{success: boolean}>};
  ASSETS: {fetch(request: Request): Promise<Response>};
  ALLOWED_ORIGINS: string;
  TURNSTILE_SECRET: string;
  UPLOADS_ENABLED: string;
};

export const CONSENT_VERSION = 'staging-2026-11-11-v3';
const PRIVACY_REFERENCE = '/live/privacy/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACTION = 'live_submission';
const MAX_ATTEMPTS = 100;

export async function sha256(bytes: Uint8Array | string) {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource)), b => b.toString(16).padStart(2, '0')).join('');
}

function text(data: FormData, key: string, max: number, required = false) {
  const value = data.get(key);
  if (value !== null && typeof value !== 'string') throw new ApiError(400, 'invalid_fields');
  const result = (value ?? '').trim().normalize('NFC');
  if ((required && !result) || result.length > max || /[\u0000-\u001f\u007f]/.test(result.replace(/[\r\n\t]/g, ''))) throw new ApiError(400, 'invalid_fields');
  return result;
}

function json(body: unknown, status: number, origin?: string) {
  const headers: Record<string, string> = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin'};
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Idempotency-Key';
  }
  if (status === 409 || status === 429 || status === 503) headers['Retry-After'] = '30';
  return new Response(JSON.stringify(body), {status, headers});
}

export async function verifyTurnstile(token: string, secret: string, hostname: string, fetcher: typeof fetch = fetch) {
  if (!secret || !token || token.length > 2048) throw new ApiError(403, 'verification_required');
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({secret, response: token}), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(503, 'verification_unavailable');
  const result = await response.json() as {success?: boolean; hostname?: string; action?: string};
  if (result.success !== true || result.hostname !== hostname || result.action !== ACTION) throw new ApiError(403, 'verification_required');
}

async function confirm(env: Env, row: Row) {
  const object = await env.PHOTOS.head(row.object_key);
  if (!object || object.customMetadata?.submissionId !== row.id || object.customMetadata?.requestHash !== row.request_hash) return false;
  if (row.processing_state !== 'ready') {
    await env.DB.prepare("UPDATE submissions SET processing_state='ready', completed_at=?, processed_bytes=?, processed_sha256=?, failure_code=NULL WHERE id=? AND processing_state IN ('receiving','retryable')")
      .bind(new Date().toISOString(), object.size, object.customMetadata.sha256, row.id).run();
  }
  const ready = await env.DB.prepare("SELECT * FROM submissions WHERE id=? AND processing_state='ready'").bind(row.id).first();
  return !!ready;
}

export async function submit(request: Request, env: Env, origin: string, fetcher: typeof fetch = fetch) {
  if (env.UPLOADS_ENABLED !== 'true') throw new ApiError(503, 'uploads_unavailable');
  const member = env.MEMBERS_ENABLED === 'true' ? await currentMember(request, env) : null;
  if (env.MEMBERS_ENABLED === 'true' && !member?.verified) throw new ApiError(401, 'sign_in_required');
  const id = request.headers.get('Idempotency-Key') ?? '';
  if (!UUID.test(id)) throw new ApiError(400, 'invalid_request');
  // Cloudflare supplies this header at the edge. Do not persist IP addresses.
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) throw new ApiError(403, 'invalid_request');
  if (!(await env.UPLOAD_LIMITER.limit({key: ip})).success) throw new ApiError(429, 'rate_limited');
  if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) throw new ApiError(415, 'invalid_request');
  const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new ApiError(413, 'image_too_large');
  const bytes = await boundedBody(request.body);
  let data: FormData;
  try { data = await new Response(bytes, {headers: {'Content-Type': request.headers.get('Content-Type')!}}).formData(); }
  catch { throw new ApiError(400, 'invalid_request'); }
  const permitted = new Set(['photo','name','description','city','country','countryCode','language','processingConsent','publicationConsent','consentVersion','turnstileToken']);
  for (const key of data.keys()) if (!permitted.has(key) || data.getAll(key).length !== 1) throw new ApiError(400, 'invalid_fields');
  if (text(data, 'processingConsent', 5) !== 'true' || text(data, 'consentVersion', 80) !== CONSENT_VERSION) throw new ApiError(400, 'consent_required');
  const publication = text(data, 'publicationConsent', 5);
  if (!['true','false'].includes(publication)) throw new ApiError(400, 'consent_required');
  const name = text(data, 'name', 60, !member);
  const displayName = member?.username ?? name;
  const description = text(data, 'description', 300, true);
  const city = text(data, 'city', 100);
  const country = text(data, 'country', 100);
  const countryCode = text(data, 'countryCode', 2);
  const language = text(data, 'language', 2, true);
  if (!['EN','FR','PT'].includes(language) || (countryCode && !/^[A-Z]{2}$/.test(countryCode))) throw new ApiError(400, 'invalid_fields');
  const photo = data.get('photo');
  if (!(photo instanceof File) || !photo.size || photo.size > MAX_IMAGE_BYTES) throw new ApiError(413, 'image_too_large');
  if (photo.type !== 'image/jpeg') throw new ApiError(415, 'invalid_image');
  const input = new Uint8Array(await photo.arrayBuffer());
  jpegDimensions(input);
  await verifyTurnstile(text(data, 'turnstileToken', 2048, true), env.TURNSTILE_SECRET, new URL(origin).hostname, fetcher);
  const hash = await sha256(JSON.stringify({name, description, city, country, countryCode, language, publication, consent: CONSENT_VERSION, photo: await sha256(input)}));
  let row = await env.DB.prepare('SELECT * FROM submissions WHERE id=?').bind(id).first();
  if (row) {
    if (row.request_hash !== hash || (row.member_id ?? null) !== (member?.id ?? null)) throw new ApiError(409, 'idempotency_conflict');
    if (row.processing_state === 'deleting' || row.expires_at <= new Date().toISOString()) throw new ApiError(410, 'submission_expired');
    // Retry also repairs an ambiguous R2 success/D1 completion failure.
    if (await confirm(env, row)) return json({id, status: 'pending'}, 200, origin);
    if (row.processing_state !== 'retryable') throw new ApiError(409, 'processing_retry');
  }
  // Reserve the id BEFORE putting any object. SQL uniqueness serializes concurrent requests.
  // A failed insert is followed by a read, never by an R2 write.
  const now = new Date();
  if (!row) {
    const key = `staging/${crypto.randomUUID()}.jpg`;
    const ownerColumn = member ? ',member_id' : '';
    const ownerValue = member ? ',?' : '';
    await env.DB.prepare(`INSERT INTO submissions(id,request_hash,object_key,created_at,display_name,description,city,country,country_code,language,processing_consent,publication_consent,consent_version,privacy_reference,consent_at,environment,processing_state,expires_at${ownerColumn})
      VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,?, 'staging','receiving',?${ownerValue}) ON CONFLICT(id) DO NOTHING`)
      .bind(id, hash, key, now.toISOString(), displayName, description, city, country, countryCode, language, publication === 'true' ? 1 : 0, CONSENT_VERSION, PRIVACY_REFERENCE, now.toISOString(), new Date(now.getTime() + 90 * 86400_000).toISOString(), ...(member ? [member.id] : [])).run();
    row = await env.DB.prepare('SELECT * FROM submissions WHERE id=?').bind(id).first();
    if (!row || row.request_hash !== hash || (row.member_id ?? null) !== (member?.id ?? null)) throw new ApiError(409, 'idempotency_conflict');
    // Only the request that allocated this unpredictable key may write it.
    if (row.object_key !== key) throw new ApiError(409, 'processing_retry');
  } else {
    const locked = await env.DB.prepare("UPDATE submissions SET processing_state='receiving', failure_code=NULL WHERE id=? AND processing_state='retryable'").bind(id).run();
    if (locked.meta.changes !== 1) throw new ApiError(409, 'processing_retry');
  }
  let putStarted = false;
  try {
    const budget = await env.DB.prepare('UPDATE staging_budget SET attempts=attempts+1 WHERE id=1 AND attempts<?').bind(MAX_ATTEMPTS).run();
    if (budget.meta.changes !== 1) throw new ApiError(503, 'staging_limit');
    let processed: Uint8Array;
    try {
      const output = await env.IMAGES.input(new Blob([input]).stream()).transform({width: 2048, height: 2048, fit: 'scale-down', metadata: 'none'})
        .output({format: 'image/jpeg', quality: 88, anim: false});
      const response = output.response();
      if (!response.ok) throw new Error('processor');
      processed = stripJpegMetadata(await boundedBody(response.body, MAX_IMAGE_BYTES));
      const dimensions = jpegDimensions(processed);
      if (dimensions.width > 2048 || dimensions.height > 2048) throw new Error('processor dimensions');
    } catch { throw new ApiError(422, 'image_processing'); }
    const processedHash = await sha256(processed);
    putStarted = true;
    await env.PHOTOS.put(row.object_key, processed, {
      onlyIf: {etagDoesNotMatch: '*'},
      httpMetadata: {contentType: 'image/jpeg', cacheControl: 'private, no-store'},
      customMetadata: {submissionId: id, requestHash: hash, sha256: processedHash},
    });
    if (!await confirm(env, row)) throw new ApiError(503, 'storage_unavailable');
    return json({id, status: 'pending'}, 201, origin);
  } catch (error) {
    // Once PUT starts its result may be ambiguous. Keep the reservation for retry/
    // scheduled reconciliation; never delete a possibly committed pending submission.
    if (!putStarted) await env.DB.prepare("UPDATE submissions SET processing_state='retryable', failure_code=? WHERE id=? AND processing_state='receiving'")
      .bind(error instanceof ApiError ? error.code : 'processing_failed', id).run();
    throw error;
  }
}

export async function reconcile(env: Env) {
  const now = new Date();
  // Expiry is intentionally short for staging. Deleting state is resumable if
  // either storage or database is temporarily unavailable.
  const expired = await env.DB.prepare('SELECT * FROM submissions WHERE expires_at<=? LIMIT 100').bind(now.toISOString()).all();
  for (const row of expired.results) {
    await env.DB.prepare("UPDATE submissions SET processing_state='deleting' WHERE id=?").bind(row.id).run();
    await env.PHOTOS.delete(row.object_key);
    await env.DB.prepare("DELETE FROM submissions WHERE id=? AND processing_state='deleting'").bind(row.id).run();
  }
  const stale = await env.DB.prepare("SELECT * FROM submissions WHERE processing_state IN ('receiving','retryable') AND created_at<? LIMIT 100")
    .bind(new Date(now.getTime() - 3600_000).toISOString()).all();
  for (const row of stale.results) {
    // An object is finalized only when its id and request hash match. A reservation
    // without an object is retained for a safe retry, rather than falsely confirmed.
    if (!await confirm(env, row)) {
      await env.DB.prepare("UPDATE submissions SET processing_state='retryable', failure_code='interrupted' WHERE id=? AND processing_state='receiving'").bind(row.id).run();
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const appOrigin = url.origin;
    if (url.pathname.startsWith('/api/members/') && env.MEMBERS_ENABLED === 'true' &&
      env.ALLOWED_ORIGINS?.split(',').map(v => v.trim()).includes(appOrigin)) {
      try { return await memberApi(request, env, url.pathname.slice('/api/members/'.length), appOrigin); }
      catch (error) { return json({error: error instanceof ApiError ? error.code : 'temporarily_unavailable'}, error instanceof ApiError ? error.status : 503); }
    }
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS?.split(',').map(v => v.trim()).includes(origin);
    if (env.MEMBERS_ENABLED === 'true' && origin !== appOrigin) return json({error: 'origin_denied'}, 403);
    if (!origin || !allowed) return json({error: 'origin_denied'}, 403);
    if (url.pathname !== '/api/submissions') return json({error: 'not_found'}, 404, origin);
    if (request.method === 'OPTIONS') {
      if (request.headers.get('Access-Control-Request-Method') !== 'POST') return json({error: 'method_denied'}, 405, origin);
      return new Response(null, {status: 204, headers: {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key', 'Vary': 'Origin'}});
    }
    if (request.method !== 'POST') return json({error: 'method_denied'}, 405, origin);
    try { return await submit(request, env, origin); }
    catch (error) { return json({error: error instanceof ApiError ? error.code : 'temporarily_unavailable'}, error instanceof ApiError ? error.status : 503, origin); }
  },
  async scheduled(_event: unknown, env: Env) { await reconcile(env); if (env.MEMBERS_ENABLED === 'true') await cleanMemberTokens(env); },
};
