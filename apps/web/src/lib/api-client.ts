import { API_BASE } from "@/lib/api-base";

export async function getToken(): Promise<string> {
  const res = await fetch("/api/token");
  if (!res.ok) throw new Error("Not authenticated");
  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch { /* Preserve a non-JSON server error. */ }
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
