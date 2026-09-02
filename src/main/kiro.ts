import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { KiroUsage } from "../shared/types";

interface TurnMetadata { metering_usage?: { value?: number | string }[] }
interface SessionFile { created_at?: string; session_state?: { conversation_metadata?: { user_turn_metadatas?: TurnMetadata[] } }; }

export function readKiroUsage(sessionsDirectory = join(homedir(), ".kiro", "sessions", "cli"), now = new Date(), quotaRoots = kiroQuotaRoots()): KiroUsage {
  if (!existsSync(sessionsDirectory)) return unavailable("Kiro CLI session data was not found.");
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(now.getTime() - 7 * 86_400_000);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonth = monthKey(now);
  const monthly = new Map<string, { credits: number; sessions: number; turns: number }>();
  let today = 0, week = 0, month = 0, allTime = 0, sessions = 0, turns = 0, latest = 0;
  let entries: string[] = [];
  try { entries = readdirSync(sessionsDirectory).filter((name) => name.endsWith(".json")); }
  catch { return unavailable("Limia could not read the Kiro CLI session directory.", "error"); }
  for (const name of entries) {
    const file = join(sessionsDirectory, name);
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as SessionFile;
      const created = parseDate(parsed.created_at);
      const sessionTurns = parsed.session_state?.conversation_metadata?.user_turn_metadatas ?? [];
      if (!created || sessionTurns.length === 0) continue;
      let credits = 0;
      for (const turn of sessionTurns) { turns += 1; for (const item of turn.metering_usage ?? []) credits += finite(item.value); }
      sessions += 1; allTime += credits;
      const key = monthKey(created), aggregate = monthly.get(key) ?? { credits: 0, sessions: 0, turns: 0 };
      aggregate.credits += credits; aggregate.sessions += 1; aggregate.turns += sessionTurns.length; monthly.set(key, aggregate);
      if (created >= startMonth) month += credits;
      if (created >= startWeek) week += credits;
      if (created >= startToday) today += credits;
      latest = Math.max(latest, statSync(file).mtimeMs);
    } catch { /* Ignore incomplete sessions while Kiro writes them. */ }
  }
  if (sessions === 0) return unavailable("No metered Kiro CLI sessions were found yet.");
  if (!monthly.has(currentMonth)) monthly.set(currentMonth, { credits: 0, sessions: 0, turns: 0 });
  const months = [...monthly.entries()].map(([key, value]) => ({ key, ...value })).sort((left, right) => right.key.localeCompare(left.key));
  return { status: "ready", today, week, month, currentMonth, months, allTime, sessions, turns, quota: readKiroQuota(quotaRoots), updatedAt: latest ? new Date(latest).toISOString() : null, message: null };
}
function parseDate(value?: string): Date | null { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function finite(value: unknown): number { const number = Number(value ?? 0); return Number.isFinite(number) ? number : 0; }
function monthKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
export function parseKiroQuotaLine(line: string): KiroUsage["quota"] {
  if (!line.includes("GetUsageLimitsCommand") || !line.includes("usageBreakdownList")) return null;
  try {
    const data = JSON.parse(line.slice(line.indexOf("{"))) as { output?: { usageBreakdownList?: Array<{ currentUsageWithPrecision?: number; usageLimitWithPrecision?: number; nextDateReset?: string; freeTrialInfo?: { currentUsageWithPrecision?: number; usageLimitWithPrecision?: number; freeTrialExpiry?: string } }> } };
    const usage = data.output?.usageBreakdownList?.[0]; if (!usage) return null;
    const bonusUsed = finite(usage.freeTrialInfo?.currentUsageWithPrecision), bonusLimit = finite(usage.freeTrialInfo?.usageLimitWithPrecision), useBonus = bonusLimit > bonusUsed;
    const used = useBonus ? bonusUsed : finite(usage.currentUsageWithPrecision), limit = useBonus ? bonusLimit : finite(usage.usageLimitWithPrecision);
    return limit > 0 ? { used, limit, remaining: Math.max(0, limit - used), resetAt: useBonus ? usage.freeTrialInfo?.freeTrialExpiry ?? null : usage.nextDateReset ?? null } : null;
  } catch { return null; }
}
function kiroQuotaRoots(): string[] { if (process.platform === "darwin") return [join(homedir(), "Library", "Application Support", "Kiro", "logs")]; if (process.platform === "win32") return [join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Kiro", "logs")]; return [join(homedir(), ".config", "Kiro", "logs")]; }
function readKiroQuota(roots: string[]): KiroUsage["quota"] { const files: string[] = []; const visit = (directory: string): void => { if (!existsSync(directory)) return; for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = join(directory, entry.name); if (entry.isDirectory()) visit(path); else if (/^q-client.*\.log$/i.test(entry.name)) files.push(path); } }; for (const root of roots) { try { visit(root); } catch { /* Skip inaccessible roots. */ } } files.sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs); for (const file of files) { try { for (const line of readFileSync(file,"utf8").split(/\r?\n/).reverse()) { const quota = parseKiroQuotaLine(line); if (quota) return quota; } } catch { /* Skip locked logs. */ } } return null; }
function unavailable(message: string, status: "not-found" | "error" = "not-found"): KiroUsage { const currentMonth = monthKey(new Date()); return { status, today: 0, week: 0, month: 0, currentMonth, months: [{ key: currentMonth, credits: 0, sessions: 0, turns: 0 }], allTime: 0, sessions: 0, turns: 0, quota: null, updatedAt: null, message }; }
