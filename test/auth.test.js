import test from "node:test";
import assert from "node:assert/strict";
import { createPasswordHash, createSessionToken, isSameOrigin, loadAuthConfig, LoginRateLimiter, parseCookies, verifyPassword, verifySessionToken } from "../lib/auth.js";

test("hashes and verifies an admin password", async () => {
  const hash = await createPasswordHash("a-secure-password-123");
  assert.equal(await verifyPassword("a-secure-password-123", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("signs sessions and rejects tampered or expired tokens", () => {
  const secret = "s".repeat(48);
  const token = createSessionToken("admin", secret, 60, 1_000);
  assert.equal(verifySessionToken(token, "admin", secret, 2_000).username, "admin");
  assert.equal(verifySessionToken(`${token}x`, "admin", secret, 2_000), null);
  assert.equal(verifySessionToken(token, "admin", secret, 62_000), null);
});

test("requires a complete authentication environment", () => {
  assert.throws(() => loadAuthConfig({ AUTH_USERNAME: "admin" }), /cấu hình đủ/);
  assert.equal(loadAuthConfig({ AUTH_USERNAME: "admin", AUTH_PASSWORD_HASH: "hash", AUTH_SESSION_SECRET: "x".repeat(32) }).enabled, true);
});

test("parses cookies and checks same-origin requests", () => {
  assert.deepEqual(parseCookies("one=1; ts_session=abc.def"), { one: "1", ts_session: "abc.def" });
  assert.equal(isSameOrigin({ headers: { origin: "https://trading.abc.net", host: "trading.abc.net" } }), true);
  assert.equal(isSameOrigin({ headers: { origin: "https://evil.example", host: "trading.abc.net" } }), false);
});

test("throttles repeated login failures", () => {
  const limiter = new LoginRateLimiter({ maxAttempts: 2, windowMs: 1_000 });
  limiter.fail("ip", 0);
  assert.equal(limiter.status("ip", 1).allowed, true);
  limiter.fail("ip", 2);
  assert.equal(limiter.status("ip", 3).allowed, false);
  assert.equal(limiter.status("ip", 1_100).allowed, true);
});
