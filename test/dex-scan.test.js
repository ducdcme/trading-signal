import test from "node:test";
import assert from "node:assert/strict";
import { scanDexTokensSequentially } from "../public/dex-scan.js";

test("scans DEX tokens as separate sequential requests and keeps a failed final token", async () => {
  const tokens = ["one", "two", "three", "four"].map(tokenAddress => ({ network: "base", tokenAddress }));
  const active = [];
  let maximumActive = 0;
  const data = await scanDexTokensSequentially(tokens, "4H", async token => {
    active.push(token.tokenAddress);
    maximumActive = Math.max(maximumActive, active.length);
    active.pop();
    if (token.tokenAddress === "four") throw new Error("temporary timeout");
    return { results: [{ ...token, status: "NONE" }] };
  });
  assert.equal(maximumActive, 1);
  assert.deepEqual(data.results.map(row => row.status), ["NONE", "NONE", "NONE", "ERROR"]);
  assert.equal(data.results[3].tokenAddress, "four");
});
