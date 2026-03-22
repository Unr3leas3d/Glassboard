const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export function generateJoinCode(): string {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[array[i] % CHARS.length];
  }
  return code;
}

export function normalizeJoinCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0") // common mistypes
    .replace(/I/g, "1")
    .slice(0, 6);
}

export function isValidJoinCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizeJoinCode(code));
}
