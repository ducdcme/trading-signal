import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const HASH_PREFIX = "scrypt";

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createPasswordHash(password, salt = randomBytes(16)) {
  if (String(password).length < 12) throw new Error("Mật khẩu phải có ít nhất 12 ký tự");
  const derived = await scryptAsync(String(password), salt, 64);
  return `${HASH_PREFIX}$${Buffer.from(salt).toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  const [prefix, saltText, expectedText] = String(encoded ?? "").split("$");
  if (prefix !== HASH_PREFIX || !saltText || !expectedText) return false;
  try {
    const expected = Buffer.from(expectedText, "base64url");
    const actual = await scryptAsync(String(password), Buffer.from(saltText, "base64url"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(username, secret, maxAgeSeconds, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ version: 1, username, expiresAt: now + maxAgeSeconds * 1000, nonce: randomBytes(12).toString("base64url") })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, username, secret, now = Date.now()) {
  const [payload, signature] = String(token ?? "").split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.version !== 1 || session.username !== username || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) return null;
    return session;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

export function sessionCookie(token, maxAgeSeconds, secure = true) {
  return [`ts_session=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`, secure ? "Secure" : ""].filter(Boolean).join("; ");
}

export function clearSessionCookie(secure = true) {
  return ["ts_session=", "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0", secure ? "Secure" : ""].filter(Boolean).join("; ");
}

export function isSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; }
  catch { return false; }
}

export class LoginRateLimiter {
  constructor({ maxAttempts = 5, windowMs = 15 * 60_000 } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.failures = new Map();
  }

  status(key, now = Date.now()) {
    const recent = (this.failures.get(key) ?? []).filter(timestamp => now - timestamp < this.windowMs);
    if (recent.length) this.failures.set(key, recent); else this.failures.delete(key);
    return { allowed: recent.length < this.maxAttempts, retryAfterSeconds: recent.length < this.maxAttempts ? 0 : Math.ceil((this.windowMs - (now - recent[0])) / 1000) };
  }

  fail(key, now = Date.now()) {
    const status = this.status(key, now);
    this.failures.set(key, [...(this.failures.get(key) ?? []), now]);
    return status;
  }

  success(key) {
    this.failures.delete(key);
  }
}

export function loadAuthConfig(env = process.env) {
  const username = String(env.AUTH_USERNAME ?? "").trim();
  const passwordHash = String(env.AUTH_PASSWORD_HASH ?? "").trim();
  const sessionSecret = String(env.AUTH_SESSION_SECRET ?? "").trim();
  const supplied = [username, passwordHash, sessionSecret].filter(Boolean).length;
  if (supplied > 0 && supplied < 3) throw new Error("Phải cấu hình đủ AUTH_USERNAME, AUTH_PASSWORD_HASH và AUTH_SESSION_SECRET");
  if (sessionSecret && sessionSecret.length < 32) throw new Error("AUTH_SESSION_SECRET phải có ít nhất 32 ký tự");
  const sessionHours = Math.min(168, Math.max(1, Number(env.AUTH_SESSION_HOURS) || 12));
  return { enabled: supplied === 3, username, passwordHash, sessionSecret, maxAgeSeconds: sessionHours * 3600 };
}
