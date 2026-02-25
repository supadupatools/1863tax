import crypto from "crypto";

export function hashPassword(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function normalizeText(value) {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
