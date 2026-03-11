import { getToken } from "./auth";

function baseUrl() {
  if (typeof window !== "undefined") {
    const explicit = (window as any).__linuxpg?.apiBaseUrl as string | undefined;
    if (explicit) return explicit;
    // Default to same hostname as the web UI, but on the API port.
    const proto = window.location.protocol === "https:" ? "https:" : "http:";
    return `${proto}//${window.location.hostname}:8080`;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
}

async function request(method: string, path: string, body?: any) {
  const token = getToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `http_${res.status}`);
  return data;
}

export function apiGet(path: string) {
  return request("GET", path);
}

export function apiPost(path: string, body: any) {
  return request("POST", path, body);
}

export function apiDelete(path: string) {
  return request("DELETE", path);
}
