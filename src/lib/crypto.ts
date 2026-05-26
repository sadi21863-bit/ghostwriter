import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? "";
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY env var must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

// Output format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// Gracefully handles legacy plaintext values (not in colon-separated format) — returns as-is.
export function decrypt(value: string): string {
  if (!value) return "";
  const parts = value.split(":");
  if (parts.length !== 3) return value;
  try {
    const key = getKey();
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const ciphertext = Buffer.from(parts[2], "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    return "";
  }
}

export function keyLast4(encryptedValue: string): string {
  const plain = decrypt(encryptedValue);
  return plain ? plain.slice(-4) : "";
}
