import test from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../lib/env.js";

test("parseEnv reads plain, quoted and exported values", () => {
  const values = parseEnv(`
# comment
PORT=3210
export COINGECKO_API_KEY="key with spaces"
SSI_API_KEY='literal-value'
TELEGRAM_CHAT_ID=-100123 # inline comment
INVALID LINE
`);

  assert.deepEqual(values, {
    PORT: "3210",
    COINGECKO_API_KEY: "key with spaces",
    SSI_API_KEY: "literal-value",
    TELEGRAM_CHAT_ID: "-100123"
  });
});
