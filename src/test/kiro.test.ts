import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseKiroQuotaLine, readKiroUsage } from "../main/kiro";

test("aggregates metering usage from Kiro CLI sessions", () => {
  const directory = mkdtempSync(join(tmpdir(), "limia-kiro-"));
  writeFileSync(join(directory, "session.json"), JSON.stringify({ created_at: "2026-09-01T10:00:00Z", session_state: { conversation_metadata: { user_turn_metadatas: [{ metering_usage: [{ value: 1.25 }, { value: "0.5" }] }, { metering_usage: [{ value: 2 }] }] } } }));
  const usage = readKiroUsage(directory, new Date("2026-09-01T20:00:00Z"), []);
  assert.equal(usage.status, "ready"); assert.equal(usage.today, 3.75); assert.equal(usage.month, 3.75); assert.equal(usage.turns, 2);
  assert.deepEqual(usage.months.map((month) => [month.key, month.credits]), [["2026-09", 3.75]]);
});

test("reports missing session directories", () => { assert.equal(readKiroUsage(join(tmpdir(), "missing-limia-directory")).status, "not-found"); });

test("parses Kiro quota when desktop usage logs are available", () => {
  const line = `GetUsageLimitsCommand ${JSON.stringify({ output: { usageBreakdownList: [{ currentUsageWithPrecision: 12, usageLimitWithPrecision: 100, nextDateReset: "2026-10-01T00:00:00Z" }] } })}`;
  assert.deepEqual(parseKiroQuotaLine(line), { used: 12, limit: 100, remaining: 88, resetAt: "2026-10-01T00:00:00Z" });
});
