import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, LimiaApi, ProviderKind, ThemePreference, UsageSnapshot } from "../shared/types";
const api: LimiaApi = {
  getUsage: () => ipcRenderer.invoke("usage:get"), refreshUsage: () => ipcRenderer.invoke("usage:refresh"),
  getSettings: () => ipcRenderer.invoke("settings:get"), setTheme: (theme: ThemePreference) => ipcRenderer.invoke("settings:theme", theme),
  setProviderEnabled: (kind: ProviderKind, enabled: boolean) => ipcRenderer.invoke("settings:provider", kind, enabled),
  setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke("settings:launch-at-login", enabled),
  resizePopup: (height: number) => ipcRenderer.invoke("window:resize", height),
  hide: () => ipcRenderer.invoke("window:hide"), quit: () => ipcRenderer.invoke("app:quit"),
  onUsageChanged: (callback) => subscribe("usage:changed", callback), onSettingsChanged: (callback) => subscribe("settings:changed", callback),
  onShowUsage: (callback) => { const listener = () => callback(); ipcRenderer.on("view:show-usage", listener); return () => ipcRenderer.removeListener("view:show-usage", listener); }
};
function subscribe<T extends UsageSnapshot | AppSettings>(channel: string, callback: (value: T) => void): () => void { const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value); ipcRenderer.on(channel, listener); return () => ipcRenderer.removeListener(channel, listener); }
contextBridge.exposeInMainWorld("limia", api);
