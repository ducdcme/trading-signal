import test from "node:test";
import assert from "node:assert/strict";
import { selectBestPool } from "../lib/geckoterminal.js";

const tokenId = "base_0xtoken";
const pool = (address, quoteId, liquidity) => ({
  attributes: { address, reserve_in_usd: String(liquidity) },
  relationships: { base_token: { data: { id: tokenId } }, quote_token: { data: { id: quoteId } } }
});
const included = [
  { id: "base_usdt", type: "token", attributes: { symbol: "USDT" } },
  { id: "base_usdc", type: "token", attributes: { symbol: "USDC" } }
];

test("prefers a USDT pool before a more liquid USDC pool", () => {
  const selected = selectBestPool([pool("usdc-pool", "base_usdc", 2_000_000), pool("usdt-pool", "base_usdt", 500_000)], "0xtoken", 100_000, included, ["USDT", "USDC"]);
  assert.equal(selected.pool.attributes.address, "usdt-pool");
  assert.equal(selected.quoteSymbol, "USDT");
});

test("falls back to USDC and rejects non-stable pairs", () => {
  const selected = selectBestPool([pool("usdc-pool", "base_usdc", 300_000), pool("other", "base_weth", 9_000_000)], "0xtoken", 100_000, included, ["USDT", "USDC"]);
  assert.equal(selected.quoteSymbol, "USDC");
});
