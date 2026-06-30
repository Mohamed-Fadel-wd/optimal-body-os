import { useEffect, useState } from "react";

export type SyncStatus = "local" | "syncing" | "synced" | "offline";

const localApiUrl = "http://127.0.0.1:8787/api";
const apiUrl = (import.meta.env.VITE_API_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname) ? localApiUrl : ""))
  .replace(/\/$/, "");

export function useSyncedState<T>(key: string, fallback: T) {
  const storageKey = `obos-${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "") as T;
    } catch {
      return fallback;
    }
  });
  const [status, setStatus] = useState<SyncStatus>(apiUrl ? "syncing" : "local");
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);

  useEffect(() => {
    if (!apiUrl) return;
    const controller = new AbortController();

    fetch(`${apiUrl}/state/${key}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`State request failed: ${response.status}`);
        return response.json() as Promise<{ value: T }>;
      })
      .then((payload) => {
        if (payload) setValue(payload.value);
        setRemoteReady(true);
        setStatus(payload ? "synced" : "syncing");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("offline");
      });

    return () => controller.abort();
  }, [key]);

  useEffect(() => {
    if (!apiUrl || !remoteReady) return;
    setStatus("syncing");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`${apiUrl}/state/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
        signal: controller.signal
      })
        .then((response) => {
          if (!response.ok) throw new Error(`State update failed: ${response.status}`);
          setStatus("synced");
        })
        .catch((error) => {
          if (error.name !== "AbortError") setStatus("offline");
        });
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [key, remoteReady, value]);

  return [value, setValue, status] as const;
}
