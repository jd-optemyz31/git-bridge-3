// Blast Analyzer — server functions (RPC wrappers).
// Thin wrappers only: handlers delegate to imported server-only helpers.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decryptToken } from "./blast-helpers.server";
import { readAiConfig } from "./blast-ai.server";
import {
  generateLiveBlastAnalysis,
  persistBlastAnalysis,
  writeAuditLog,
  type BlastAnalysis,
  type BlastReply,
} from "./blast-core.server";

export type { BlastAnalysis, BlastReply } from "./blast-core.server";

// ---------------------------------------------------------------------------
// List saved analyses for a client
// ---------------------------------------------------------------------------

export type BlastAnalysisSummary = {
  id: string;
  clientId: string;
  dateStart: string;
  dateEnd: string;
  replyTag: string;
  messagePhrase: string;
  taggedContactCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  optOutCount: number;
  needsReviewCount: number;
  totalRepliedContacts: number;
  analysisMethod: string | null;
  summary: string | null;
  createdAt: string;
};

const listSchema = z.object({ clientId: z.string().uuid() });

export const listBlastAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => listSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("blast_analyses")
      .select("*")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): BlastAnalysisSummary => ({
      id: r.id,
      clientId: r.client_id,
      dateStart: r.date_start,
      dateEnd: r.date_end,
      replyTag: r.reply_tag,
      messagePhrase: r.message_phrase,
      taggedContactCount: r.total_replied_contacts ?? 0,
      positiveCount: r.positive_count ?? 0,
      neutralCount: r.neutral_count ?? 0,
      negativeCount: r.negative_count ?? 0,
      optOutCount: r.opt_out_count ?? 0,
      needsReviewCount: r.needs_review_count ?? 0,
      totalRepliedContacts: r.total_replied_contacts ?? 0,
      analysisMethod: r.analysis_method ?? null,
      summary: r.summary ?? null,
      createdAt: r.created_at,
    }));
  });

// ---------------------------------------------------------------------------
// Get a single analysis with its classified replies
// ---------------------------------------------------------------------------

const getSchema = z.object({ id: z.string().uuid() });

export type BlastAnalysisDetail = BlastAnalysisSummary & {
  replies: BlastReply[];
};

export const getBlastAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => getSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("blast_analyses")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Analysis not found.");

    const { data: clsRows } = await context.supabase
      .from("blast_reply_classifications")
      .select("*")
      .eq("blast_analysis_id", data.id)
      .order("created_at", { ascending: true });

    const replies: BlastReply[] = (clsRows ?? []).map((c: any): BlastReply => ({
      id: c.id,
      contactId: c.contact_id ?? "",
      contactName: c.contact_name ?? "Unknown contact",
      lastReplyDate: "",
      classification: c.classification,
      summary: c.summary ?? "",
      evidence: "",
      threadMessageCount: 0,
      blastContextMatched: false,
      confidence: c.confidence ?? null,
      analysisMethod: c.analysis_method ?? "",
      analysisNote: "",
      reviewStatus: c.review_status ?? "pending",
      analysisStatus: "Analyzed",
      analyzed: true,
      serviceRelevance: "Unclear",
      relevanceReason: "",
      doNotDisturb: false,
      dndChannel: "",
    }));

    return {
      id: row.id,
      clientId: row.client_id,
      dateStart: row.date_start,
      dateEnd: row.date_end,
      replyTag: row.reply_tag,
      messagePhrase: row.message_phrase,
      taggedContactCount: row.total_replied_contacts ?? 0,
      positiveCount: row.positive_count ?? 0,
      neutralCount: row.neutral_count ?? 0,
      negativeCount: row.negative_count ?? 0,
      optOutCount: row.opt_out_count ?? 0,
      needsReviewCount: row.needs_review_count ?? 0,
      totalRepliedContacts: row.total_replied_contacts ?? 0,
      analysisMethod: (row as Record<string, unknown>)["analysis_method"] as string | null ?? null,
      summary: row.summary ?? null,
      createdAt: row.created_at,
      replies,
    } satisfies BlastAnalysisDetail;
  });

// ---------------------------------------------------------------------------
// Run a live blast analysis (sync, returns the full analysis)
// ---------------------------------------------------------------------------

const runSchema = z.object({
  clientId: z.string().uuid(),
  dateStart: z.string().min(1),
  dateEnd: z.string().min(1),
  replyTag: z.string().min(1),
  messagePhrase: z.string().min(1),
  workflowName: z.string().optional(),
});

export type RunBlastResult = {
  analysis: BlastAnalysis;
};

export const runBlastAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => runSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Load the client (RLS-scoped to the signed-in user).
    const { data: clientRow, error: clientErr } = await context.supabase
      .from("clients")
      .select("*")
      .eq("id", data.clientId)
      .single();
    if (clientErr || !clientRow) throw new Error("Client not found or no access.");
    if (!clientRow.ghl_private_integration_token_encrypted) {
      throw new Error("This client has no connected HighLevel token. Connect one on the Clients page first.");
    }

    const token = decryptToken(clientRow.ghl_private_integration_token_encrypted);
    if (!token) throw new Error("HighLevel token could not be decrypted. Reconnect the client.");

    const aiConfig = readAiConfig();
    const client = {
      id: clientRow.id,
      name: clientRow.name,
      locationId: clientRow.ghl_location_id,
      tokenCiphertext: clientRow.ghl_private_integration_token_encrypted,
    };

    const analysis = await generateLiveBlastAnalysis({
      client,
      token,
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      replyTag: data.replyTag,
      workflowName: data.workflowName ?? "",
      messagePhrase: data.messagePhrase,
      aiConfig,
    });

    await persistBlastAnalysis(context.supabase, analysis, context.userId);

    // Record a completed job row for history/audit (best-effort).
    try {
      await context.supabase.from("blast_jobs").insert({
        client_id: client.id,
        user_id: context.userId,
        status: "done",
        phase: "done",
        phase_label: "Complete",
        percent: 100,
        reply_tag: data.replyTag,
        message_phrase: data.messagePhrase,
        date_start: data.dateStart,
        date_end: data.dateEnd,
        blast_analysis_id: analysis.id,
      });
    } catch {
      // job persistence is best-effort
    }

    await writeAuditLog(context.supabase, {
      userId: context.userId,
      clientId: client.id,
      action: "blast.generate",
      targetType: "blast_analysis",
      targetId: analysis.id,
      message: "Live blast analysis completed.",
    });

    return { analysis } satisfies RunBlastResult;
  });

// Re-export so callers can import progress shaping without reaching into the
// server-only module directly.
export { blastProgress } from "./blast-progress.server";