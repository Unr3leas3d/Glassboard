function getBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  return env?.DEV ? "http://localhost:1421" : "index.html";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeWindowPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return encodeURIComponent(bytesToBase64(bytes));
}

export function decodeWindowPayload<T>(raw: string | null, errorMessage: string): T {
  if (!raw) {
    throw new Error(errorMessage);
  }

  const bytes = base64ToBytes(raw);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

export function buildWindowUrl(windowType: string, payload?: unknown): string {
  const baseUrl = getBaseUrl();
  if (payload === undefined) {
    return `${baseUrl}?window=${windowType}`;
  }

  return `${baseUrl}?window=${windowType}&payload=${encodeWindowPayload(payload)}`;
}
