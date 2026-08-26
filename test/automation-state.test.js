import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveAutomationState } from "../lib/automation-store.js";

test("automation state persists batch slots for restart-safe at-most-once scheduling", async () => {
  const dir = await mkdtemp(join(tmpdir(), "trading-signal-state-"));
  const path = join(dir, "state.json");
  try {
    await saveAutomationState(path, {
      sentKeys: ["a", "a", "b"],
      lastRuns: {},
      lastSlots: { stockDaily: "2026-08-26|15:30" },
      batchSlots: { "2026-08-26|15:30": { status: "sending", at: 1, jobs: ["stockDaily"] } }
    });
    const saved = JSON.parse(await readFile(path, "utf8"));
    assert.equal(saved.schemaVersion, 11);
    assert.deepEqual(saved.sentKeys, ["a", "b"]);
    assert.equal(saved.batchSlots["2026-08-26|15:30"].status, "sending");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
