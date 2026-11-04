const encoder = new TextEncoder();
export function randomToken(bytes = 32) { return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, "0")).join(""); }
export async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))), b => b.toString(16).padStart(2, "0")).join(""); }
export function equal(a: string, b: string) { let difference = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return difference === 0; }
export function validCredentials(username: unknown, password: unknown): username is string { return typeof username === "string" && /^[A-Za-z0-9_.-]{3,32}$/.test(username) && typeof password === "string" && password.length >= 14 && password.length <= 128; }
export async function passwordHash(password: string, salt: string, pepper: string) {
  if (pepper.length < 32) throw new Error("Login secret missing");
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  const signing = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", signing, derived)), b => b.toString(16).padStart(2, "0")).join("");
}
