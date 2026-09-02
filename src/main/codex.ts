import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CodexUsage, UsageWindow } from "../shared/types";

export function codexAuthPath(home = homedir(), env: NodeJS.ProcessEnv = process.env): string { return join(env.CODEX_HOME || join(home, ".codex"), "auth.json"); }
export function parseCodexAuth(content: string): { access: string; accountId: string } | null {
  try { const value = JSON.parse(content) as { tokens?: { access_token?: string; account_id?: string }; openai?: { access?: string; accountId?: string } }; if (value.tokens?.access_token && value.tokens.account_id) return { access: value.tokens.access_token, accountId: value.tokens.account_id }; if (value.openai?.access && value.openai.accountId) return { access: value.openai.access, accountId: value.openai.accountId }; } catch { /* Invalid auth file. */ }
  return null;
}
export function parseCodexUsage(content: string, now = new Date()): CodexUsage {
  try {
    const value = JSON.parse(content) as { rate_limit?: { primary_window?: { used_percent?: number; reset_at?: number }; secondary_window?: { used_percent?: number; reset_at?: number } } };
    const limits = value.rate_limit, windows: UsageWindow[] = [];
    if (limits?.primary_window?.used_percent !== undefined) windows.push(toWindow("Current session", limits.primary_window));
    if (limits?.secondary_window?.used_percent !== undefined) windows.push(toWindow("Weekly limit", limits.secondary_window));
    if (windows.length) return { status: "ready", windows, updatedAt: now.toISOString(), message: null };
  } catch { /* Invalid response. */ }
  return { status: "error", windows: [], updatedAt: null, message: "Codex returned an invalid usage response." };
}
export async function readCodexUsage(): Promise<CodexUsage> {
  const path = codexAuthPath();
  if (!existsSync(path)) return missing("Sign in to Codex before enabling this provider.");
  const auth = parseCodexAuth(readFileSync(path, "utf8"));
  if (!auth) return missing("Limia could not read the current Codex session.");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://chatgpt.com/backend-api/wham/usage", { headers: { Authorization: `Bearer ${auth.access}`, "ChatGPT-Account-Id": auth.accountId, "User-Agent": "Limia/0.1" }, signal: controller.signal });
    if (!response.ok) return { status: "error", windows: [], updatedAt: null, message: response.status === 401 ? "Your Codex session has expired. Sign in again." : `Codex usage request failed (${response.status}).` };
    return parseCodexUsage(await response.text());
  } catch { return { status: "error", windows: [], updatedAt: null, message: "Limia could not connect to Codex." }; }
  finally { clearTimeout(timer); }
}
function toWindow(label: string, value: { used_percent?: number; reset_at?: number }): UsageWindow { return { label, usedPercent: Math.max(0, Math.min(100, Number(value.used_percent ?? 0))), resetAt: value.reset_at ? new Date(value.reset_at * 1000).toISOString() : null }; }
function missing(message: string): CodexUsage { return { status: "not-found", windows: [], updatedAt: null, message }; }
