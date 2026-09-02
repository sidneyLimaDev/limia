import test from "node:test";
import assert from "node:assert/strict";
import { parseCodexAuth, parseCodexUsage } from "../main/codex";

test("reads current Codex authentication format", () => {
  assert.deepEqual(parseCodexAuth(JSON.stringify({ tokens: { access_token: "token", account_id: "account" } })), { access: "token", accountId: "account" });
});

test("parses Codex session and weekly percentages", () => {
  const usage = parseCodexUsage(JSON.stringify({ rate_limit: { primary_window: { used_percent: 18, reset_at: 1_800_000_000 }, secondary_window: { used_percent: 42, reset_at: 1_800_100_000 } } }), new Date("2026-09-02T12:00:00Z"));
  assert.equal(usage.status, "ready");
  assert.deepEqual(usage.windows.map((window) => [window.label, window.usedPercent]), [["Current session", 18], ["Weekly limit", 42]]);
});
