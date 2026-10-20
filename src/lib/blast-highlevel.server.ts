// Blast Analyzer — HighLevel CRM read-only API + pagination.
// Server-only.

import {
  contactCursorFromPayload,
  contactId,
  extractContacts,
  extractMessages,
  filterSearchedContacts,
  isWithinDateRange,
  messageId,
  parseJsonMaybe,
  sanitizeApiDetail,
  timestampOf,
} from "./blast-helpers.server";

const HIGHLEVEL_BASE_URL = "https://services.leadconnectorhq.com";
const DEFAULT_HL_VERSION = "2021-07-28";

const HIGHLEVEL_READ_ALLOWLIST = new Set([
  "GET /contacts/",
  "POST /contacts/search",
  "GET /conversations/search",
  "GET /conversations/messages/export",
  "GET /opportunities/search",
  "POST /opportunities/search",
  "GET /workflows",
  "GET /workflows/",
]);

export type HlClient = {
  id: string;
  name: string;
  locationId: string;
  tokenCiphertext: string;
};

function assertHighLevelReadOnly(method: string, endpointPath: string) {
  const pathname = new URL(endpointPath, HIGHLEVEL_BASE_URL).pathname;
  const key = `${method.toUpperCase()} ${pathname}`;
  if (!HIGHLEVEL_READ_ALLOWLIST.has(key)) {
    throw new Error(`Blocked HighLevel API operation: ${key}`);
  }
}

export async function highLevelRequest(
  client: HlClient,
  opts: { method?: string; endpointPath: string; query?: Record<string, any>; body?: any; apiVersion?: string; token: string },
): Promise<any> {
  const method = opts.method || "GET";
  assertHighLevelReadOnly(method, opts.endpointPath);
  if (!opts.token) {
    const error: any = new Error("HighLevel token is missing for this client.");
    error.status = 400;
    throw error;
  }

  const url = new URL(opts.endpointPath, HIGHLEVEL_BASE_URL);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const init: RequestInit = {
    method,
    headers: {
      authorization: `Bearer ${opts.token}`,
      accept: "application/json",
      "content-type": "application/json",
      version: opts.apiVersion || DEFAULT_HL_VERSION,
    },
  };
  if (opts.body) init.body = JSON.stringify(opts.body);

  const response = await fetch(url, init);

  const raw = await response.text();
  const payload = raw ? parseJsonMaybe(raw) : {};
  if (!response.ok) {
    const error: any = new Error("HighLevel API request failed.");
    error.status = response.status;
    error.detail = sanitizeApiDetail(typeof payload === "string" ? payload : payload?.message || payload?.error || raw);
    throw error;
  }
  return payload;
}

async function collectPagedHighLevelItems({
  fetchPage, extractItems, itemId, onPage, pageSize = 100, maxPages = 1, failOnPageLimit = false,
  pageLimitErrorMessage = "HighLevel pagination reached its configured safety limit.",
}: {
  fetchPage: (page: number, pageSize: number) => Promise<any>;
  extractItems: (payload: any) => any[];
  itemId: (item: any) => string;
  onPage?: ((info: { page: number; pageItemCount: number; itemCount: number }) => void | Promise<void>) | undefined;
  pageSize?: number; maxPages?: number; failOnPageLimit?: boolean; pageLimitErrorMessage?: string;
}): Promise<any[]> {
  const items: any[] = [];
  const seen = new Set<string>();
  let lastPageItemCount = 0;
  let pagesFetched = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await fetchPage(page, pageSize);
    const pageItems = extractItems(payload);
    lastPageItemCount = pageItems.length;
    pagesFetched = page;
    for (const item of pageItems) {
      const id = itemId(item);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      items.push(item);
    }
    if (onPage) await onPage({ page, pageItemCount: pageItems.length, itemCount: items.length });
    if (pageItems.length < pageSize) break;
  }
  if (failOnPageLimit && pagesFetched === maxPages && lastPageItemCount >= pageSize) {
    throw new Error(pageLimitErrorMessage);
  }
  return items;
}

async function collectCursorPagedHighLevelItems({
  fetchPage, extractItems, extractCursor, itemId, onPage, pageSize = 100, maxPages = 1, failOnPageLimit = false,
  pageLimitErrorMessage = "HighLevel cursor pagination reached its configured safety limit.",
  missingCursorErrorMessage = "HighLevel returned a full page without a cursor for the next contact page.",
}: {
  fetchPage: (cursor: any, pageSize: number) => Promise<any>;
  extractItems: (payload: any) => any[];
  extractCursor: (payload: any, pageItems: any[]) => any;
  itemId: (item: any) => string;
  onPage?: ((info: { page: number; pageItemCount: number; itemCount: number }) => void | Promise<void>) | undefined;
  pageSize?: number; maxPages?: number; failOnPageLimit?: boolean; pageLimitErrorMessage?: string; missingCursorErrorMessage?: string;
}): Promise<any[]> {
  const items: any[] = [];
  const seen = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: any = null;
  let lastPageItemCount = 0;
  let pagesFetched = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await fetchPage(cursor, pageSize);
    const pageItems = extractItems(payload);
    lastPageItemCount = pageItems.length;
    pagesFetched = page;
    for (const item of pageItems) {
      const id = itemId(item);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      items.push(item);
    }
    if (onPage) await onPage({ page, pageItemCount: pageItems.length, itemCount: items.length });
    if (pageItems.length < pageSize) break;
    const nextCursor = extractCursor(payload, pageItems);
    if (!nextCursor) {
      if (failOnPageLimit) throw new Error(missingCursorErrorMessage);
      break;
    }
    const key = JSON.stringify(nextCursor);
    if (seenCursors.has(key)) {
      throw new Error("HighLevel repeated the same contact cursor; the scan was stopped to avoid incomplete results.");
    }
    seenCursors.add(key);
    cursor = nextCursor;
  }
  if (failOnPageLimit && pagesFetched === maxPages && lastPageItemCount >= pageSize) {
    throw new Error(pageLimitErrorMessage);
  }
  return items;
}

export function dailyUtcWindows(dateStart: string, dateEnd: string): { startDate: string; endDate: string }[] {
  if (!dateStart || !dateEnd) return [{ startDate: "", endDate: "" }];
  const rangeStart = Date.parse(`${dateStart}T00:00:00.000Z`);
  const rangeEnd = Date.parse(`${dateEnd}T23:59:59.999Z`);
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart > rangeEnd) {
    throw new Error("A valid date range is required.");
  }
  const windows: { startDate: string; endDate: string }[] = [];
  const day = 86_400_000;
  for (let start = rangeStart; start <= rangeEnd; start += day) {
    windows.push({
      startDate: new Date(start).toISOString(),
      endDate: new Date(Math.min(rangeEnd, start + day - 1)).toISOString(),
    });
  }
  return windows;
}

export async function highLevelSearchContacts(
  client: HlClient,
  token: string,
  opts: {
    dateStart?: string; dateEnd?: string; replyTag?: string; limit?: number; maxPages?: number;
    createdDateFilter?: boolean;
    onPageProgress?: (info: { mode: string; count: number }) => void | Promise<void>;
  },
): Promise<any[]> {
  const { dateStart, dateEnd, replyTag = "", limit = 100, maxPages = 1, createdDateFilter = true, onPageProgress } = opts;
  const filters: any[] = [];
  if (replyTag) filters.push({ field: "tags", operator: "contains", value: replyTag });
  if (createdDateFilter && dateStart && dateEnd) {
    filters.push({ field: "dateAdded", operator: "range", value: { gte: `${dateStart}T00:00:00.000Z`, lte: `${dateEnd}T23:59:59.999Z` } });
  }
  const offsetPageLimit = Math.min(maxPages, 100);

  const searchPages = (searchFilters: any[]) =>
    collectPagedHighLevelItems({
      pageSize: limit, maxPages: offsetPageLimit, failOnPageLimit: maxPages > 1,
      pageLimitErrorMessage: "HighLevel offset pagination reached its 10,000-contact window.",
      itemId: contactId, extractItems: extractContacts,
      onPage: onPageProgress ? ({ itemCount }) => onPageProgress({ mode: "filtered", count: itemCount }) : undefined,
      fetchPage: (page, pageSize) =>
        highLevelRequest(client, {
          method: "POST", endpointPath: "/contacts/search", token,
          body: { locationId: client.locationId, page, pageLimit: pageSize, ...(searchFilters.length ? { filters: searchFilters } : {}) },
        }),
    });

  try {
    const filtered = filterSearchedContacts(await searchPages(filters), {
      dateStart: dateStart ?? "",
      dateEnd: dateEnd ?? "",
      replyTag,
      createdDateFilter,
      trustServerTagFilter: Boolean(replyTag),
    });
    if (filtered.length || !replyTag) return filtered;
  } catch {
    // fall through to cursor scan
  }

  const cursorContacts = await collectCursorPagedHighLevelItems({
    pageSize: limit, maxPages, failOnPageLimit: maxPages > 1,
    pageLimitErrorMessage: "HighLevel returned more contacts than the Blast Analyzer 50,000-contact safety limit. Narrow the account data before trusting this run.",
    missingCursorErrorMessage: "HighLevel did not provide a cursor for the next contact page, so the Blast Analyzer stopped instead of saving partial results.",
    itemId: contactId, extractItems: extractContacts, extractCursor: contactCursorFromPayload,
    onPage: onPageProgress ? ({ itemCount }) => onPageProgress({ mode: "cursor", count: itemCount }) : undefined,
    fetchPage: (cursor, pageSize) =>
      highLevelRequest(client, {
        method: "GET", endpointPath: "/contacts/", token,
        query: { locationId: client.locationId, limit: pageSize, ...(cursor || {}) },
      }),
  });

  return filterSearchedContacts(cursorContacts, {
    dateStart: dateStart ?? "",
    dateEnd: dateEnd ?? "",
    replyTag,
    createdDateFilter,
    trustServerTagFilter: false,
  });
}

export async function highLevelExportMessages(
  client: HlClient,
  token: string,
  opts: { dateStart: string; dateEnd: string; channel?: string; onWindowProgress?: (info: { done: number; total: number; messageCount: number }) => void | Promise<void> },
): Promise<any[]> {
  const messages: any[] = [];
  const seen = new Set<string>();
  const maxPagesPerDay = 50;
  const pageLimit = 100;
  const retryable = new Set([401, 429, 500, 502, 503, 504]);
  const windows = dailyUtcWindows(opts.dateStart, opts.dateEnd);

  for (let i = 0; i < windows.length; i += 1) {
    const window = windows[i];
    if (!window) continue;
    let cursor = "";
    for (let page = 0; page < maxPagesPerDay; page += 1) {
      let payload: any;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          payload = await highLevelRequest(client, {
            method: "GET", endpointPath: "/conversations/messages/export", token,
            query: {
              locationId: client.locationId, startDate: window.startDate, endDate: window.endDate,
              channel: opts.channel || "", limit: pageLimit, pageLimit, cursor,
            },
          });
          break;
        } catch (error: any) {
          if (!retryable.has(Number(error.status)) || attempt === 2) throw error;
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      for (const message of extractMessages(payload)) {
        const id = messageId(message);
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        messages.push(message);
      }
      cursor = payload?.nextCursor || payload?.cursor || payload?.meta?.nextCursor || "";
      if (!cursor) break;
      if (page === maxPagesPerDay - 1) {
        const error: any = new Error("HighLevel message export exceeded the safe daily page limit.");
        error.status = 422;
        error.detail = "The selected day contains too many messages to analyze completely. Run a narrower date range.";
        throw error;
      }
    }
    if (opts.onWindowProgress) {
      await opts.onWindowProgress({ done: i + 1, total: windows.length, messageCount: messages.length });
    }
  }
  return messages.filter((m) => isWithinDateRange(m, opts.dateStart, opts.dateEnd));
}
