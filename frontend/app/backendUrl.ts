/** Resolve the backend from browser settings without sending LAN clients to their own localhost. */
export const SETTINGS_CHANGED_EVENT = "fallguard_settings_changed";

export function getBackendBaseUrl(): string {
  const fallback = `http://${window.location.hostname}:8000`;
  try {
    const saved = localStorage.getItem("fallguard_settings");
    const configured = saved ? JSON.parse(saved).serverUrl : null;
    if (typeof configured !== "string") return fallback;
    const url = new URL(configured.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    const loopback = ["localhost", "127.0.0.1"].includes(url.hostname);
    const localBrowser = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    return loopback && !localBrowser ? fallback : url.origin;
  } catch {
    return fallback;
  }
}
