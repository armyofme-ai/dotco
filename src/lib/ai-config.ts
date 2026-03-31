import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || "default-dev-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function getAIConfig(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { llmProvider: true, llmApiKey: true, llmModel: true },
  });

  const provider = org?.llmProvider || "openai";
  const model = org?.llmModel || "gpt-4o";
  const apiKey = org?.llmApiKey
    ? decrypt(org.llmApiKey)
    : process.env.OPENAI_API_KEY;

  return { provider, model, apiKey: apiKey || null };
}

export async function getDeepgramKey(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { deepgramApiKey: true },
  });
  if (org?.deepgramApiKey) return decrypt(org.deepgramApiKey);
  return process.env.DEEPGRAM_API_KEY || null;
}

export async function getResendKey(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { resendApiKey: true },
  });
  if (org?.resendApiKey) return decrypt(org.resendApiKey);
  return process.env.RESEND_API_KEY || null;
}
