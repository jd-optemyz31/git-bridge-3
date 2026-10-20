// Blast Analyzer — shared helpers, field extractors, token crypto.
// Server-only. Imported by the other blast.*.server.ts modules.

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Token encryption (AES-256-GCM) — mirrors the original app
// ---------------------------------------------------------------------------

function encryptionKey(): Buffer {
  const secret = process.env["APP_ENCRYPTION_KEY"] || "local-dev-lead-hero-health-check";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(value: string): string {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptToken(value: string | null | undefined): string {
  if (!value) return "";
  const [ivRaw, tagRaw, encryptedRaw] = String(value).split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "";
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivRaw, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Generic JSON / text helpers
// ---------------------------------------------------------------------------

export function parseJsonMaybe(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function parseJsonObject(text: string | null | undefined): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function sanitizeApiDetail(text: unknown): string {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 240 ? `${clean.slice(0, 240)}...` : clean;
}

export function truncateForAi(text: unknown, maxLength = 2000): string {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

export function findFirstArrayByKeys(value: any, keys: string[], depth = 0): any[] {
  if (!value || depth > 4) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key];
  }
  for (const nested of Object.values(value)) {
    const found = findFirstArrayByKeys(nested, keys, depth + 1);
    if (found.length) return found;
  }
  return [];
}

export function valueText(record: any, keys: string[]): string {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null) return String(record[key]);
  }
  return "";
}

export function timestampOf(record: any): number {
  const value =
    record?.createdAt ||
    record?.dateAdded ||
    record?.dateCreated ||
    record?.updatedAt ||
    record?.timestamp ||
    record?.messageDate ||
    record?.date;
  if (!value) return 0;
  if (typeof value === "number") return value < 100000000000 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isWithinDateRange(record: any, dateStart?: string, dateEnd?: string): boolean {
  if (!dateStart || !dateEnd) return true;
  const ts = timestampOf(record);
  if (!ts) return true;
  const start = Date.parse(`${dateStart}T00:00:00.000Z`);
  const end = Date.parse(`${dateEnd}T23:59:59.999Z`);
  return ts >= start && ts <= end;
}

// ---------------------------------------------------------------------------
// Contact / message field extractors
// ---------------------------------------------------------------------------

export function extractContacts(payload: any): any[] {
  return findFirstArrayByKeys(payload, ["contacts", "items", "results", "data"]);
}
export function extractMessages(payload: any): any[] {
  return findFirstArrayByKeys(payload, ["messages", "items", "results", "data"]);
}
export function contactId(contact: any): string {
  return valueText(contact, ["id", "contactId", "contact_id", "_id"]);
}
export function contactName(contact: any): string {
  const fullName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim();
  return (
    contact?.name ||
    contact?.fullName ||
    fullName ||
    contact?.email ||
    contact?.phone ||
    contact?.id ||
    "Unknown contact"
  );
}
export function contactTags(contact: any): string[] {
  const tags = contact?.tags || contact?.contactTags || contact?.tag;
  if (Array.isArray(tags)) {
    return tags
      .map((t: any) => (typeof t === "string" ? t : t?.name || t?.value || ""))
      .filter(Boolean);
  }
  return String(tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
export function contactHasTag(contact: any, tag: string): boolean {
  if (!tag) return true;
  const needle = tag.toLowerCase();
  return contactTags(contact).some(
    (t) => t.toLowerCase() === needle || t.toLowerCase().includes(needle),
  );
}
export function messageText(message: any): string {
  return valueText(message, ["body", "message", "text", "content", "subject", "snippet"]);
}
export function messageId(message: any): string {
  return valueText(message, ["id", "messageId", "message_id", "_id"]);
}
export function messageContactId(message: any): string {
  return (
    valueText(message, ["contactId", "contact_id", "contactID"]) ||
    valueText(message?.contact || {}, ["id", "contactId", "contact_id", "_id"]) ||
    valueText(message?.conversation || {}, ["contactId", "contact_id", "contactID"])
  );
}
export function messageChannel(message: any): string {
  return valueText(message, [
    "channel",
    "messageChannel",
    "message_channel",
    "conversationProvider",
    "source",
    "medium",
  ]);
}
export function isCallMessage(message: any): boolean {
  const channel = messageChannel(message).toLowerCase();
  const type = valueText(message, ["type", "messageType", "message_type"]).toLowerCase();
  return channel.includes("call") || type.includes("call");
}
export function isOutboundMessage(message: any): boolean {
  const direction = valueText(message, ["direction", "messageDirection", "type"]).toLowerCase();
  return direction.includes("out") || direction.includes("sent");
}
export function isInboundMessage(message: any): boolean {
  const direction = valueText(message, ["direction", "messageDirection", "type"]).toLowerCase();
  return direction.includes("in") || direction.includes("received");
}
export function messageTimestamp(message: any): string {
  return valueText(message, ["dateAdded", "createdAt", "created_at", "timestamp", "time"]);
}
export function messageDirectionLabel(message: any): string {
  if (isInboundMessage(message)) return "inbound";
  if (isOutboundMessage(message)) return "outbound";
  return "unknown";
}

export function findContactPaginationMeta(value: any, depth = 0): any {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return {};
  if (
    value.startAfter !== undefined ||
    value.startAfterId !== undefined ||
    value.nextStartAfter !== undefined ||
    value.nextStartAfterId !== undefined ||
    value.start_after !== undefined ||
    value.start_after_id !== undefined ||
    value.next_start_after !== undefined ||
    value.next_start_after_id !== undefined
  ) {
    return value;
  }
  for (const nested of Object.values(value)) {
    const found = findContactPaginationMeta(nested, depth + 1);
    if (Object.keys(found).length) return found;
  }
  return {};
}

export function contactCursorFromPayload(
  payload: any,
  pageItems: any[],
): { startAfter: string; startAfterId: string } | null {
  const meta = findContactPaginationMeta(payload);
  const lastContact = pageItems.at(-1);
  const startAfter =
    meta.nextStartAfter ??
    meta.startAfter ??
    meta.next_start_after ??
    meta.start_after ??
    String(timestampOf(lastContact || {}));
  const startAfterId =
    meta.nextStartAfterId ??
    meta.startAfterId ??
    meta.next_start_after_id ??
    meta.start_after_id ??
    contactId(lastContact || {});
  if (!startAfter || !startAfterId) return null;
  return { startAfter, startAfterId };
}

export function filterSearchedContacts(
  contacts: any[],
  opts: {
    dateStart?: string;
    dateEnd?: string;
    replyTag?: string;
    createdDateFilter?: boolean;
    trustServerTagFilter?: boolean;
  },
): any[] {
  return contacts.filter((contact) => {
    const matchesDate =
      !opts.createdDateFilter || isWithinDateRange(contact, opts.dateStart, opts.dateEnd);
    const matchesTag = opts.trustServerTagFilter || contactHasTag(contact, opts.replyTag || "");
    return matchesDate && matchesTag;
  });
}
