function getBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  return env?.DEV ? "http://localhost:1421" : "index.html";
}

export function encodeWindowPayload(payload: unknown): string {
  return encodeURIComponent(btoa(JSON.stringify(payload)));
}

export function decodeWindowPayload<T>(raw: string | null, errorMessage: string): T {
  if (!raw) {
    throw new Error(errorMessage);
  }

  return JSON.parse(atob(raw)) as T;
}

export function buildWindowUrl(windowType: string, payload?: unknown): string {
  const baseUrl = getBaseUrl();
  if (payload === undefined) {
    return `${baseUrl}?window=${windowType}`;
  }

  return `${baseUrl}?window=${windowType}&payload=${encodeWindowPayload(payload)}`;
}
