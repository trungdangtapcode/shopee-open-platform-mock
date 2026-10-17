import crypto from "crypto";

export const rid = (): string => crypto.randomBytes(8).toString("hex");
export const ts = (): number => Math.floor(Date.now() / 1000);
export const nowStr = (): string =>
  new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

export function parseListParam(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((v) => String(v).split(",")).map((s) => s.trim()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
