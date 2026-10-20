// Blast Analyzer — core analysis orchestration.
// Server-only. Combines CRM export + thread anchoring + AI classification.

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  contactId,
  contactName,
  isInboundMessage,
  isOutboundMessage,
  messageContactId,
  messageText,
  messageTimestamp,
} from "./blast-helpers.server";
import {
  highLevelExportMessages,
  highLevelSearchContacts,
  type HlClient,
} from "./blast-highlevel.server";
import {
  blastThreadForContact,
  contactDndStatus,
  blastContactAnalysisState,
} from "./blast-rules.server";
import { classifyBlastReplyWithAi, type BlastAiConfig } from "./blast-ai.server";
import { blastProgress, mapWithConcurrency, type BlastProgress } from "./blast-progress.server";

export type BlastReply = {
  id: string;
  contactId: string;
  contactName: string;
  lastReplyDate: string;
  classification: string;
  summary: string;
  evidence: string;
  threadMessageCount: number;
  blastContextMatched: boolean;
  confidence: number | null;
  analysisMethod: string;
  analysisNote: string;
  reviewStatus: string;
  analysisStatus: string;
  analyzed: boolean;
  serviceRelevance: string;
  relevanceReason: string;
  doNotDisturb: boolean;
  dndChannel: string;
};

export type BlastAnalysis = {
  id: string;
  clientId: string;
  clientName: string;
  dateStart: string;
  dateEnd: string;
  replyTag: string;
  workflowName: string;
  messagePhrase: string;
  messageType: string;
  taggedContactCount: number;
  totalRepliedContacts: number;
  analyzedContactCount: number;
  matchedBlastCount: number;
  noBlastMatchCount: number;
  matchedBlastWithoutReplyCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  optOutCount: number;
  needsReviewCount: number;
  summary: string;
  source: string;
  analysisMethod: string;
  replies: BlastReply[];
  createdAt: string;
};

export async function generateLiveBlastAnalysis({
  client,
  token,
  dateStart,
  dateEnd,
  replyTag,
  workflowName,
  messagePhrase,
  aiConfig,
  onProgress,
}: {
  client: HlClient;
  token: string;
  dateStart: string;
  dateEnd: string;
  replyTag: string;
  workflowName: string;
  messagePhrase: string;
  aiConfig: BlastAiConfig;
  onProgress?: (p: BlastProgress) => void | Promise<void>;
}): Promise<BlastAnalysis> {
  if (onProgress) await onProgress(blastProgress("contacts", { count: 0 }));
  const contacts = await highLevelSearchContacts(client, token, {
    dateStart,
    dateEnd,
    replyTag,
    limit: 100,
    maxPages: 500,
    createdDateFilter: false,
    onPageProgress: ({ mode, count }) => onProgress?.(blastProgress("contacts", { mode, count })),
  });

  const messageWindowCount = dailyUtcWindowsCount(dateStart, dateEnd);
  if (onProgress) await onProgress(blastProgress("messages", { done: 0, total: messageWindowCount }));
  const messages = await highLevelExportMessages(client, token, {
    dateStart,
    dateEnd,
    onWindowProgress: ({ done, total, messageCount }) =>
      onProgress?.(blastProgress("messages", {
        done,
        total,
        count: messageCount,
        detail: `${done} of ${total} date windows exported; ${messageCount.toLocaleString()} messages loaded read-only.`,
      })),
  });

  if (onProgress) await onProgress(blastProgress("matching", { count: contacts.length }));
  const contactIds = new Set(contacts.map((c) => contactId(c)));
  const contactContexts = contacts.map((contact) => {
    const id = contactId(contact);
    const ctx = blastThreadForContact(messages, id, messagePhrase);
    return {
      contact,
      contactId: id,
      latest: ctx.latest,
      latestCandidate: ctx.latestCandidate,
      thread: ctx.thread,
      matchedBlast: ctx.matchedBlast,
      blastFound: ctx.blastFound,
    };
  });
  const contactsWithMatchedBlast = contactContexts.filter((c) => c.blastFound);
  const contactsWithInboundReplies = contactContexts.filter((c) => c.blastFound && c.latest);
  const total = contactContexts.length;
  if (onProgress) await onProgress(blastProgress("classifying", { done: 0, total }));

  let progressDone = 0;
  const replies = await mapWithConcurrency(contactContexts, 5, async (ctx) => {
    const dndStatus = contactDndStatus(ctx.contact, ctx.matchedBlast?.channel || "SMS");
    const analysisState = blastContactAnalysisState({ blastFound: ctx.blastFound, latest: ctx.latest });
    const lastReplyDate = messageTimestamp(ctx.latest || ctx.latestCandidate) || "";
    if (!analysisState.eligible) {
      progressDone++;
      if (onProgress) await onProgress(blastProgress("classifying", { done: progressDone, total }));
      return {
        id: crypto.randomUUID(),
        contactId: ctx.contactId,
        contactName: contactName(ctx.contact),
        lastReplyDate,
        classification: "Not analyzed",
        summary: analysisState.reason,
        evidence: analysisState.status,
        threadMessageCount: ctx.thread.length,
        blastContextMatched: ctx.blastFound,
        confidence: null,
        analysisMethod: "Not analyzed",
        analysisNote: "",
        reviewStatus: analysisState.status,
        analysisStatus: analysisState.status,
        analyzed: false,
        serviceRelevance: "Unclear",
        relevanceReason: analysisState.reason,
        doNotDisturb: dndStatus.isDnd,
        dndChannel: dndStatus.isDnd ? dndStatus.channel : "",
      } satisfies BlastReply;
    }

    const analysis = await classifyBlastReplyWithAi({
      phrase: messagePhrase,
      promotedOffer: ctx.matchedBlast?.text || "",
      thread: ctx.thread,
      dndStatus,
      aiConfig,
    });
    progressDone++;
    if (onProgress) await onProgress(blastProgress("classifying", { done: progressDone, total }));
    return {
      id: crypto.randomUUID(),
      contactId: ctx.contactId,
      contactName: contactName(ctx.contact),
      lastReplyDate,
      classification: analysis.classification,
      summary: analysis.summary,
      evidence: analysis.evidence || `Matched HighLevel contact tag "${replyTag}" within the selected date range.`,
      threadMessageCount: ctx.thread.length,
      blastContextMatched: ctx.blastFound,
      confidence: analysis.confidence,
      analysisMethod: analysis.analysisMethod,
      analysisNote: analysis.analysisNote,
      reviewStatus: analysis.reviewStatus,
      analysisStatus: "Analyzed",
      analyzed: true,
      serviceRelevance: analysis.serviceRelevance,
      relevanceReason: analysis.relevanceReason,
      doNotDisturb: dndStatus.isDnd,
      dndChannel: dndStatus.isDnd ? dndStatus.channel : "",
    } satisfies BlastReply;
  });

  const noBlastMatchCount = Math.max(0, contacts.length - contactsWithMatchedBlast.length);
  const matchedBlastWithoutReplyCount = Math.max(0, contactsWithMatchedBlast.length - contactsWithInboundReplies.length);

  const phraseMatches = messages.filter((m) => {
    if (!messagePhrase) return false;
    const cid = messageContactId(m);
    return isOutboundMessage(m) && !contactIds.has(cid) && messageText(m).toLowerCase().includes(messagePhrase.toLowerCase());
  });
  const analyzedReplies = replies.filter((r) => r.analyzed);
  const counts = analyzedReplies.reduce<Record<string, number>>((acc, r) => {
    acc[r.classification] = (acc[r.classification] || 0) + 1;
    return acc;
  }, {});
  const aiClassifiedCount = analyzedReplies.filter((r) => String(r.analysisMethod || "").startsWith("AI")).length;
  const fallbackClassifiedCount = analyzedReplies.filter((r) => String(r.analysisMethod || "").includes("Rules")).length;
  const dndClassifiedCount = analyzedReplies.filter((r) => r.analysisMethod === "HighLevel DND").length;
  const analysisMethods = [
    aiClassifiedCount ? "AI" : "",
    dndClassifiedCount ? "HighLevel DND" : "",
    fallbackClassifiedCount ? (aiConfig.apiKey ? "rules fallback" : "rules") : "",
  ].filter(Boolean);
  const analysisMethod = analysisMethods.length ? analysisMethods.join(" + ") : "No classifications";
  const methodParts = [
    aiClassifiedCount ? `${aiClassifiedCount} reply/replies were classified by AI` : "",
    dndClassifiedCount ? `${dndClassifiedCount} were classified from read-only HighLevel DND status` : "",
    fallbackClassifiedCount ? `${fallbackClassifiedCount} used ${aiConfig.apiKey ? "rules fallback" : "rules because AI is not configured"}` : "",
  ].filter(Boolean);
  const methodSummary = methodParts.length ? `${methodParts.join(", ")}.` : "No reply conversations were classified.";
  const fallbackReasons = [...new Set(analyzedReplies.map((r) => r.analysisNote).filter(Boolean))];
  const fallbackReasonSummary = fallbackReasons.length ? ` Reason: ${fallbackReasons.slice(0, 2).join(" ")}` : "";
  const blastContextMatches = analyzedReplies.filter((r) => r.blastContextMatched).length;
  const threadSummary = `${blastContextMatches} classified reply thread(s) were anchored to the matching outbound blast and included every exported message from that blast onward inside the selected date range.`;

  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    dateStart,
    dateEnd,
    replyTag,
    workflowName,
    messagePhrase,
    messageType: "SMS",
    taggedContactCount: contacts.length,
    totalRepliedContacts: analyzedReplies.length,
    analyzedContactCount: analyzedReplies.length,
    matchedBlastCount: contactsWithMatchedBlast.length,
    noBlastMatchCount,
    matchedBlastWithoutReplyCount,
    positiveCount: counts["Positive"] || 0,
    neutralCount: counts["Neutral"] || 0,
    negativeCount: counts["Negative"] || 0,
    optOutCount: counts["Opt-out"] || 0,
    needsReviewCount: counts["Needs review"] || 0,
    summary: `${contacts.length} tagged contact(s) were found and all ${contacts.length} are listed below. ${contactsWithMatchedBlast.length} had a matching outbound blast. ${contactsWithInboundReplies.length} had an inbound reply after that blast and were classified. ${matchedBlastWithoutReplyCount} matched the blast but had no later inbound reply. ${noBlastMatchCount} had no matching outbound blast and were not force-classified. ${phraseMatches.length} extra message(s) matched the required phrase without the reply tag. ${threadSummary} ${methodSummary}${fallbackReasonSummary}`,
    source: "live",
    analysisMethod,
    replies,
    createdAt: new Date().toISOString(),
  };
}

// Local copy of dailyUtcWindows count (avoids importing the highlevel module just for counting)
function dailyUtcWindowsCount(dateStart: string, dateEnd: string): number {
  if (!dateStart || !dateEnd) return 1;
  const rangeStart = Date.parse(`${dateStart}T00:00:00.000Z`);
  const rangeEnd = Date.parse(`${dateEnd}T23:59:59.999Z`);
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart > rangeEnd) return 1;
  return Math.max(1, Math.round((rangeEnd - rangeStart) / 86_400_000) + 1);
}

// ---------------------------------------------------------------------------
// Persistence (Cloud)
// ---------------------------------------------------------------------------

export async function persistBlastAnalysis(
  supabase: SupabaseClient<Database>,
  analysis: BlastAnalysis,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("blast_analyses")
    .insert({
      id: analysis.id,
      client_id: analysis.clientId,
      date_start: analysis.dateStart,
      date_end: analysis.dateEnd,
      reply_tag: analysis.replyTag,
      workflow_name_or_id: analysis.workflowName || null,
      message_phrase: analysis.messagePhrase,
      total_replied_contacts: analysis.totalRepliedContacts,
      positive_count: analysis.positiveCount,
      negative_count: analysis.negativeCount,
      neutral_count: analysis.neutralCount,
      opt_out_count: analysis.optOutCount,
      needs_review_count: analysis.needsReviewCount,
      summary: analysis.summary,
      created_by_user_id: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to save blast analysis: ${error.message}`);

  const analysisId = data.id;
  const rows = analysis.replies.map((r) => ({
    blast_analysis_id: analysisId,
    contact_id: r.contactId || null,
    contact_name: r.contactName || null,
    conversation_id: null,
    classification: r.classification,
    summary: r.summary || null,
    evidence_message_ids: null,
    confidence: r.confidence ?? null,
    analysis_method: r.analysisMethod || null,
    review_status: r.reviewStatus || "pending",
  }));
  if (rows.length) {
    const { error: clsErr } = await supabase.from("blast_reply_classifications").insert(rows);
    if (clsErr) throw new Error(`Failed to save classifications: ${clsErr.message}`);
  }
  return analysisId;
}

export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  event: { userId?: string | null; clientId?: string | null; action: string; targetType?: string; targetId?: string; status?: string; message?: string },
): Promise<void> {
  try {
    await supabase.from("api_audit_logs").insert({
      user_id: event.userId || null,
      client_id: event.clientId || null,
      action: String(event.action || "unknown").slice(0, 120),
      target_type: String(event.targetType || "").slice(0, 80),
      target_id: String(event.targetId || "").slice(0, 160),
      status: event.status === "failure" ? "failure" : "success",
      message: String(event.message || "").slice(0, 500),
    });
  } catch {
    // audit is best-effort
  }
}