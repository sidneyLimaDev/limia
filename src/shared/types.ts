export type ProviderKind = "Kiro" | "Codex";
export type ThemePreference = "system" | "light" | "dark";
export interface MonthUsage { key: string; credits: number; sessions: number; turns: number; }
export interface CreditQuota { used: number; limit: number; remaining: number; resetAt: string | null; }
export interface KiroUsage { status: "ready" | "not-found" | "error"; today: number; week: number; month: number; currentMonth: string; months: MonthUsage[]; allTime: number; sessions: number; turns: number; quota: CreditQuota | null; updatedAt: string | null; message: string | null; }
export interface UsageWindow { label: string; usedPercent: number; resetAt: string | null; }
export interface CodexUsage { status: "ready" | "not-found" | "error"; windows: UsageWindow[]; updatedAt: string | null; message: string | null; }
export interface UsageSnapshot { kiro: KiroUsage; codex: CodexUsage; }
export interface AppSettings { enabledProviders: ProviderKind[]; theme: ThemePreference; launchAtLogin: boolean; }
export interface LimiaApi {
  getUsage(): Promise<UsageSnapshot>; refreshUsage(): Promise<UsageSnapshot>;
  getSettings(): Promise<AppSettings>; setTheme(theme: ThemePreference): Promise<AppSettings>;
  setProviderEnabled(kind: ProviderKind, enabled: boolean): Promise<AppSettings>;
  setLaunchAtLogin(enabled: boolean): Promise<AppSettings>;
  resizePopup(height: number): Promise<void>;
  hide(): Promise<void>; quit(): Promise<void>;
  onUsageChanged(callback: (usage: UsageSnapshot) => void): () => void;
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void;
  onShowUsage(callback: () => void): () => void;
}
