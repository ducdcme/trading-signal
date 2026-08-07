import test from "node:test";
import assert from "node:assert/strict";
import { chartReturnUrl, initialAppTab, normalizeAppTab, shouldRestoreScanCache } from "../public/navigation-state.js";

test("restores the Coin mới tab from the URL hash before session state", () => {
  assert.equal(initialAppTab("#new-coins", "cex"), "new-coins");
});

test("restores a valid tab from session state when the URL has no tab", () => {
  assert.equal(initialAppTab("", "focus"), "focus");
  assert.equal(initialAppTab("#unknown", "new-coins"), "new-coins");
});

test("chart return URLs are constrained to known app tabs", () => {
  assert.equal(chartReturnUrl("new-coins"), "/#new-coins");
  assert.equal(chartReturnUrl("bad-tab"), "/#cex");
  assert.equal(normalizeAppTab("FOCUS"), "focus");
});

test("scan cache is restored after navigation but cleared by an explicit reload", () => {
  assert.equal(shouldRestoreScanCache("navigate"), true);
  assert.equal(shouldRestoreScanCache("back_forward"), true);
  assert.equal(shouldRestoreScanCache("reload"), false);
});
