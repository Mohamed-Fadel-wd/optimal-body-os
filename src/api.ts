import { useEffect, useState } from "react";

export type SyncStatus = "local" | "syncing" | "synced" | "offline";

const localApiUrl = "http://127.0.0.1:8787/api";
const apiUrl = (import.meta.env.VITE_API_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname) ? localApiUrl : ""))
  .replace(/\/$/, "");

function expireSession(response: Response) {
  if (response.status === 401) {
    localStorage.removeItem("obos-token");
    window.dispatchEvent(new Event("obos:unauthorized"));
  }
}

export async function login(password: string) {
  if (!apiUrl) throw new Error("The API URL is not configured.");
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to sign in");
  return payload.token as string;
}

export function useSyncedState<T>(key: string, fallback: T, token: string | null) {
  const cloudEnabled = Boolean(apiUrl && token && token !== "local-only");
  const storageKey = `obos-${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "") as T;
    } catch {
      return fallback;
    }
  });
  const [status, setStatus] = useState<SyncStatus>(cloudEnabled ? "syncing" : "local");
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);

  useEffect(() => {
    if (!cloudEnabled) {
      setRemoteReady(false);
      setStatus("local");
      return;
    }
    const controller = new AbortController();

    fetch(`${apiUrl}/state/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then(async (response) => {
        expireSession(response);
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
  }, [cloudEnabled, key, token]);

  useEffect(() => {
    if (!cloudEnabled || !token || !remoteReady) return;
    setStatus("syncing");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`${apiUrl}/state/${key}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
        signal: controller.signal
      })
        .then((response) => {
          expireSession(response);
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
  }, [cloudEnabled, key, remoteReady, token, value]);

  return [value, setValue, status] as const;
}
