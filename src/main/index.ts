import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppSettings, ProviderKind, ThemePreference, UsageSnapshot } from "../shared/types";
import { readCodexUsage } from "./codex";
import { readKiroUsage } from "./kiro";

const REFRESH_INTERVAL_MS = 30_000;
let popup: BrowserWindow | null = null, tray: Tray | null = null, isQuitting = false;
let settings: AppSettings = { enabledProviders: ["Kiro"], theme: "system", launchAtLogin: false };
function settingsPath(): string { return join(app.getPath("userData"), "settings.json"); }
function loadSettings(): void { try { const value = JSON.parse(readFileSync(settingsPath(), "utf8")) as Partial<AppSettings>; if (Array.isArray(value.enabledProviders)) settings.enabledProviders = value.enabledProviders.filter((kind): kind is ProviderKind => kind === "Kiro" || kind === "Codex"); if (value.theme === "system" || value.theme === "light" || value.theme === "dark") settings.theme = value.theme; } catch { /* Use defaults. */ } }
function saveSettings(): void { writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8"); }
function createPopup(): BrowserWindow {
  const window = new BrowserWindow({ width: 316, height: 334, show: false, frame: false, transparent: process.platform !== "darwin", vibrancy: process.platform === "darwin" ? "popover" : undefined, visualEffectState: process.platform === "darwin" ? "active" : undefined, resizable: false, maximizable: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: "#00000000", webPreferences: { preload: join(__dirname, "../preload/index.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.loadFile(join(__dirname, "../renderer/index.html")); window.on("blur", () => window.hide()); window.on("close", (event) => { if (!isQuitting) { event.preventDefault(); window.hide(); } }); return window;
}
function createTray(): void {
  const logoPath = app.isPackaged ? join(process.resourcesPath, "limia.png") : join(app.getAppPath(), "bloub-hexagone-attentif-encre.png"), icon = nativeImage.createFromPath(logoPath).resize({ width: 18, height: 18 });
  if (process.platform === "darwin") icon.setTemplateImage(true); tray = new Tray(icon); tray.setToolTip("Limia — AI usage"); if (process.platform === "darwin") tray.setTitle(" Limia");
  const menu = Menu.buildFromTemplate([{ label: "Open Limia", click: togglePopup }, { label: "Refresh", click: publishUsage }, { type: "separator" }, { label: "Quit Limia", click: () => { isQuitting = true; app.quit(); } }]); tray.on("click", togglePopup); tray.on("right-click", () => tray?.popUpContextMenu(menu));
}
function togglePopup(): void { if (!popup || !tray) return; if (popup.isVisible()) { popup.hide(); return; } popup.webContents.send("view:show-usage"); const bounds = tray.getBounds(), display = screen.getDisplayNearestPoint({ x: Math.round(bounds.x), y: Math.round(bounds.y) }), size = popup.getBounds(); const x = Math.round(Math.min(display.workArea.x + display.workArea.width - size.width - 8, Math.max(display.workArea.x + 8, bounds.x + bounds.width / 2 - size.width / 2))); const y = process.platform === "darwin" ? Math.round(bounds.y + bounds.height + 5) : Math.round(bounds.y - size.height - 8); popup.setPosition(x, y, false); popup.show(); popup.focus(); void publishUsage(); }
async function usageSnapshot(): Promise<UsageSnapshot> { return { kiro: readKiroUsage(), codex: settings.enabledProviders.includes("Codex") ? await readCodexUsage() : { status: "not-found", windows: [], updatedAt: null, message: null } }; }
async function publishUsage(): Promise<void> { popup?.webContents.send("usage:changed", await usageSnapshot()); }
app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.hide();
  loadSettings();
  settings.launchAtLogin = app.getLoginItemSettings().openAtLogin;
  popup = createPopup();
  createTray();
  ipcMain.handle("usage:get", usageSnapshot);
  ipcMain.handle("usage:refresh", usageSnapshot);
  ipcMain.handle("settings:get", () => settings);
  ipcMain.handle("settings:theme", (_event, theme: unknown) => {
    if (theme !== "system" && theme !== "light" && theme !== "dark") throw new Error("Invalid theme.");
    settings = { ...settings, theme: theme as ThemePreference };
    saveSettings();
    popup?.webContents.send("settings:changed", settings);
    return settings;
  });
  ipcMain.handle("settings:provider", async (_event, kind: unknown, enabled: unknown) => {
    if ((kind !== "Kiro" && kind !== "Codex") || typeof enabled !== "boolean") throw new Error("Invalid provider setting.");
    const selected = new Set(settings.enabledProviders);
    enabled ? selected.add(kind) : selected.delete(kind);
    settings = { ...settings, enabledProviders: [...selected] };
    saveSettings();
    popup?.webContents.send("settings:changed", settings);
    await publishUsage();
    return settings;
  });
  ipcMain.handle("settings:launch-at-login", (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") throw new Error("Invalid login item setting.");
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
    settings = { ...settings, launchAtLogin: enabled };
    saveSettings();
    popup?.webContents.send("settings:changed", settings);
    return settings;
  });
  ipcMain.handle("window:resize", (_event, height: unknown) => {
    if (typeof height !== "number" || !Number.isFinite(height)) throw new Error("Invalid popup height.");
    popup?.setSize(316, Math.max(128, Math.min(334, Math.round(height))), false);
  });
  ipcMain.handle("window:hide", () => popup?.hide());
  ipcMain.handle("app:quit", () => { isQuitting = true; app.quit(); });
  setInterval(publishUsage, REFRESH_INTERVAL_MS).unref();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
