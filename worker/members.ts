import { resetSubjects, verificationEmail } from "./member-email.ts";
import { ApiError, boundedBody } from "./image.ts";
import { sha256, type Env } from "./index.ts";

type Member = { id: string; email: string; username: string; password_hash: string; relationship: string; company: string; display_name: string; avatar: string; verified: number; language: string };
const cookie = "__Host-aponte-member";
const encode = new TextEncoder();
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
const tokenPattern = /^[a-f0-9]{64}$/;
const sessionAge = 30 * 86400;

function reply(body: unknown, session?: string) {
  const headers = new Headers({"Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"});
  if (session !== undefined) headers.set("Set-Cookie", `${cookie}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${session ? sessionAge : 0}`);
  return new Response(JSON.stringify(body), {headers});
}

function sessionToken(request: Request) {
  return request.headers.get("Cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(cookie + "="))?.slice(cookie.length + 1) ?? "";
}

export async function currentMember(request: Request, env: Env) {
  const token = sessionToken(request);
  if (!tokenPattern.test(token)) return null;
  return env.DB.prepare("SELECT members.* FROM member_sessions JOIN members ON members.id=member_sessions.member_id WHERE token_hash=? AND expires_at>?")
    .bind(await sha256(token), Date.now()).first<Member>();
}

function profile(member: Member) {
  const {username, email, relationship, company, display_name, avatar, verified} = member;
  return {username, email, relationship, company, displayName: display_name, avatar, verified: Boolean(verified)};
}

async function passwordHash(password: string, salt = randomToken()) {
  const key = await crypto.subtle.importKey("raw", encode.encode(password), "PBKDF2", false, ["deriveBits"]);
  // Workers limit PBKDF2 to 100,000 iterations per operation. Chain independently salted rounds.
  let bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: encode.encode(salt), iterations: 100000}, key, 256);
  for (let round = 1; round < 6; round++) {
    const next = await crypto.subtle.importKey("raw", bits, "PBKDF2", false, ["deriveBits"]);
    bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: encode.encode(salt + ":" + round), iterations: 100000}, next, 256);
  }
  return salt + ":" + Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, "0")).join("");
}

function sameHash(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

async function signIn(env: Env, member: Member) {
  const token = randomToken();
  const result = await env.DB.prepare("INSERT INTO member_sessions SELECT ?, id, ? FROM members WHERE id=? AND password_hash=?")
    .bind(await sha256(token), Date.now() + sessionAge * 1000, member.id, member.password_hash).run();
  if (!result.meta.changes) throw new ApiError(401, "invalid_login");
  return reply({member: profile(member)}, token);
}

function requireMail(env: Env) {
  if (!env.RESEND_API_KEY || !env.MEMBER_EMAIL_FROM) throw new ApiError(503, "mail_unavailable");
}

async function sendLink(env: Env, member: Member, purpose: "verify" | "reset", origin: string, draft = "") {
  requireMail(env);
  const token = randomToken();
  const hash = await sha256(token);
  const ttl = purpose === "verify" ? 86400_000 : 1800_000;
  await env.DB.prepare("INSERT INTO member_links VALUES(?,?,?,?)").bind(hash, member.id, purpose, Date.now() + ttl).run();
  const url = new URL(draft && purpose === "verify" ? "/live/share/" : "/live/account/", origin);
  url.hash = new URLSearchParams({[purpose]: token, ...(draft && purpose === "verify" ? {draft} : {})}).toString();
  const email = purpose === "verify" ? verificationEmail(member.language, url) : {
    subject: (resetSubjects[member.language as keyof typeof resetSubjects] ?? resetSubjects.EN),
    text: (resetSubjects[member.language as keyof typeof resetSubjects] ?? resetSubjects.EN) + "\n\n" + url,
  };
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: {Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json"},
      body: JSON.stringify({from: env.MEMBER_EMAIL_FROM, to: [member.email], ...email}),
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error("email delivery");
  } catch {
    await env.DB.prepare("DELETE FROM member_links WHERE token_hash=?").bind(hash).run();
    throw new ApiError(503, "mail_unavailable");
  }
}

function field(data: Record<string, unknown>, key: string, max: number) {
  const value = data[key] ?? "";
  if (typeof value !== "string" || value.length > max) throw new ApiError(400, "invalid_fields");
  return value;
}

export async function memberApi(request: Request, env: Env, path: string, origin: string) {
  const member = await currentMember(request, env);
  if (request.method === "GET" && path === "session") return reply({member: member && profile(member)});
  if (request.method === "GET" && (path === "photos" || path.startsWith("photos/"))) {
    if (!member?.verified) throw new ApiError(401, "sign_in_required");
    const filter = "member_id=? AND processing_state='ready' AND expires_at>?";
    const now = new Date().toISOString();
    if (path === "photos") {
      const rows = await env.DB.prepare(`SELECT id, description, created_at AS createdAt FROM submissions WHERE ${filter} ORDER BY created_at DESC`)
        .bind(member.id, now).all<{id: string; description: string; createdAt: string}>();
      const decisions = new Map<string, string>();
      for (let offset = 0; offset < rows.results.length; offset += 50) {
        const ids = rows.results.slice(offset, offset + 50).map(row => row.id);
        const reviews = await env.REVIEW_DB.prepare(`SELECT submission_id, decision FROM photo_reviews WHERE submission_id IN (${ids.map(() => "?").join(",")})`)
          .bind(...ids).all<{submission_id: string; decision: string}>();
        for (const review of reviews.results) decisions.set(review.submission_id, review.decision);
      }
      return reply({photos: rows.results.map(row => {
        const decision = decisions.get(row.id);
        return {...row, status: decision === "selected" ? "approved" : decision === "hidden" ? "declined" : "pending"};
      })});
    }
    const row = await env.DB.prepare(`SELECT object_key FROM submissions WHERE ${filter} AND id=?`).bind(member.id, now, path.slice(7)).first();
    const object = row && await env.PHOTOS.get(row.object_key);
    if (!object) throw new ApiError(404, "not_found");
    return new Response(object.body, {headers: {"Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
  }
  if (request.method !== "POST" || request.headers.get("Origin") !== origin) throw new ApiError(403, "origin_denied");
  if (path === "logout") {
    if (member) await env.DB.prepare("DELETE FROM member_sessions WHERE token_hash=?").bind(await sha256(sessionToken(request))).run();
    return reply({ok: true}, "");
  }
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || !(await env.MEMBER_LIMITER.limit({key: ip})).success) throw new ApiError(429, "rate_limited");
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw new ApiError(415, "invalid_request");
  let data: Record<string, unknown>;
  try { data = JSON.parse(new TextDecoder().decode(await boundedBody(request.body, 100_000))); }
  catch { throw new ApiError(400, "invalid_fields"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400, "invalid_fields");
  if (path === "delete-test-account") {
    if (env.TEST_ACCOUNT_DELETION !== "true") throw new ApiError(404, "not_found");
    if (!member) throw new ApiError(401, "sign_in_required");
    await env.DB.batch([
      env.DB.prepare("UPDATE submissions SET member_id=NULL, display_name='', processing_state='deleting', expires_at=? WHERE member_id=?")
        .bind(new Date(Date.now() + 3600_000).toISOString(), member.id),
      env.DB.prepare("DELETE FROM members WHERE id=?").bind(member.id),
    ]);
    return reply({ok: true}, "");
  }
  const email = field(data, "email", 254).trim().toLowerCase();
  const password = field(data, "password", 128);
  const draft = field(data, "draft", 36);
  if (draft && !/^[a-f0-9-]{36}$/.test(draft)) throw new ApiError(400, "invalid_fields");

  if (path === "register" || path === "reset") {
    if (!password.length || Array.from(password).length > 15) throw new ApiError(400, "invalid_fields");
    if (password !== field(data, "passwordConfirmation", 128)) throw new ApiError(400, "password_mismatch");
  }
  if (path === "register") {
    if (data.adult !== true) throw new ApiError(400, "age_required");
    requireMail(env);
    const username = field(data, "username", 40).trim();
    const relationship = field(data, "relationship", 20);
    const company = field(data, "company", 100).trim();
    const language = field(data, "language", 2);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[\p{L}\p{N}_.-]{3,40}$/u.test(username) ||
      !["customer", "partner", "distributor", "other"].includes(relationship) || !["EN", "FR", "PT"].includes(language)) throw new ApiError(400, "invalid_fields");
    const created: Member = {id: crypto.randomUUID(), email, username, password_hash: await passwordHash(password), relationship, company, display_name: "", avatar: "", verified: 0, language};
    const result = await env.DB.prepare("INSERT INTO members(id,email,username,password_hash,relationship,company,language,created_at,adult_confirmed_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING")
      .bind(created.id, email, username, created.password_hash, relationship, company, language, new Date().toISOString(), new Date().toISOString()).run();
    if (!result.meta.changes) throw new ApiError(409, "account_exists");
    const response = await signIn(env, created);
    try { await sendLink(env, created, "verify", origin, draft); }
    catch { return new Response(JSON.stringify({member: profile(created), mailFailed: true}), {headers: response.headers}); }
    return response;
  }

  if (path === "login" || path === "forgot") {
    if (!(await env.MEMBER_LIMITER.limit({key: path + ":" + await sha256(email)})).success) throw new ApiError(429, "rate_limited");
    const found = await env.DB.prepare("SELECT * FROM members WHERE email=?").bind(email).first<Member>();
    if (path === "forgot") {
      requireMail(env);
      if (found?.verified) await sendLink(env, found, "reset", origin);
      return reply({ok: true});
    }
    const hash = await passwordHash(password, found?.password_hash.split(":")[0] ?? "0".repeat(64));
    if (!found || !sameHash(found.password_hash, hash)) throw new ApiError(401, "invalid_login");
    return signIn(env, found);
  }
  if (path === "resend") {
    if (!member) throw new ApiError(401, "sign_in_required");
    if (!member.verified) await sendLink(env, member, "verify", origin, draft);
    return reply({ok: true});
  }
  if (path === "verify" || path === "reset") {
    const token = field(data, "token", 64);
    if (!tokenPattern.test(token)) throw new ApiError(400, "invalid_fields");
    const hash = await sha256(token);
    const link = await env.DB.prepare("SELECT member_id FROM member_links WHERE token_hash=? AND purpose=? AND expires_at>?")
      .bind(hash, path, Date.now()).first<{member_id: string}>();
    if (!link) throw new ApiError(400, "invalid_link");
    if (path === "verify" && member?.id !== link.member_id) throw new ApiError(401, "verify_sign_in");
    const existing = "SELECT 1 FROM member_links WHERE token_hash=? AND expires_at>?";
    const now = Date.now();
    const change = path === "reset"
      ? env.DB.prepare(`UPDATE members SET password_hash=? WHERE id=? AND EXISTS (${existing})`).bind(await passwordHash(password), link.member_id, hash, now)
      : env.DB.prepare(`UPDATE members SET verified=1 WHERE id=? AND EXISTS (${existing})`).bind(link.member_id, hash, now);
    const updates = [change];
    if (path === "reset") updates.push(env.DB.prepare(`DELETE FROM member_sessions WHERE member_id=? AND EXISTS (${existing})`).bind(link.member_id, hash, now));
    updates.push(env.DB.prepare(`DELETE FROM member_links WHERE member_id=? AND purpose=? AND EXISTS (${existing})`).bind(link.member_id, path, hash, now));
    const [result] = await env.DB.batch(updates);
    if (!result.meta.changes) throw new ApiError(400, "invalid_link");
    return reply({ok: true}, path === "reset" ? "" : undefined);
  }
  if (path === "profile") {
    if (!member?.verified) throw new ApiError(401, "sign_in_required");
    const displayName = field(data, "displayName", 60).trim();
    const company = field(data, "company", 100).trim();
    const avatar = field(data, "avatar", 90000);
    if (avatar && !/^data:image\/jpeg;base64,\/[A-Za-z0-9+/=]+$/.test(avatar)) throw new ApiError(400, "invalid_fields");
    await env.DB.prepare("UPDATE members SET display_name=?, company=?, avatar=? WHERE id=?").bind(displayName, company, avatar, member.id).run();
    return reply({member: profile({...member, display_name: displayName, company, avatar})});
  }
  throw new ApiError(404, "not_found");
}

export async function cleanMemberTokens(env: Env) {
  const now = Date.now();
  await env.DB.prepare("DELETE FROM member_sessions WHERE expires_at<=?").bind(now).run();
  await env.DB.prepare("DELETE FROM member_links WHERE expires_at<=?").bind(now).run();
}
