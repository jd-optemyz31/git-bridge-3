// Blast Analyzer — AI classification (OpenAI / OpenRouter).
// Server-only.

import {
  parseJsonObject,
  parseJsonMaybe,
  sanitizeApiDetail,
  truncateForAi,
} from "./blast-helpers.server";

export type BlastAiConfig = {
  provider: "openai" | "openrouter";
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function readAiConfig(): BlastAiConfig {
  const configuredBaseUrl = (
    process.env["OPENAI_BASE_URL"] ||
    process.env["OPENAI_API_BASE_URL"] ||
    process.env["AI_BASE_URL"] ||
    ""
  ).trim();
  const detectedProvider =
    configuredBaseUrl.includes("openrouter") || process.env["OPENROUTER_API_KEY"] ? "openrouter" : "openai";
  const provider = normalizeAiProvider(process.env["AI_PROVIDER"] || detectedProvider);
  const baseUrl = normalizeAiBaseUrl(
    configuredBaseUrl ||
      (provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1"),
  );
  const apiKey = (provider === "openrouter" ? process.env["OPENROUTER_API_KEY"] || "" : process.env["OPENAI_API_KEY"] || "").trim();
  const configuredModel = process.env["OPENAI_MODEL"] || (provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini");
  const model = normalizeOpenAiModel(configuredModel, provider);
  return { provider, baseUrl, apiKey, model };
}

function normalizeAiProvider(provider: string): "openai" | "openrouter" {
  const clean = String(provider || "openai").trim().toLowerCase();
  return clean === "openrouter" ? "openrouter" : "openai";
}
function normalizeAiBaseUrl(value: string): string {
  return String(value || "").trim().replace(/\/$/, "");
}
function normalizeOpenAiModel(model: string, provider: "openai" | "openrouter"): string {
  const clean = String(model || "gpt-4o-mini").trim();
  if (provider === "openrouter") return clean.includes("/") ? clean : `openai/${clean}`;
  return clean.startsWith("openai/") ? clean.slice("openai/".length) : clean;
}

// ---------------------------------------------------------------------------
// Label normalization
// ---------------------------------------------------------------------------

const blastClassificationLabels = new Set(["Positive", "Neutral", "Negative", "Opt-out", "Needs review"]);
const blastClassificationAliases = new Map<string, string>([
  ["positive", "Positive"], ["interested", "Positive"], ["interest", "Positive"],
  ["neutral", "Neutral"], ["negative", "Negative"], ["not interested", "Negative"],
  ["not_interested", "Negative"], ["low interest", "Negative"], ["low_interest", "Negative"],
  ["opt-out", "Opt-out"], ["opt out", "Opt-out"], ["optout", "Opt-out"], ["opt_out", "Opt-out"],
  ["unsubscribe", "Opt-out"], ["needs review", "Needs review"], ["needs_review", "Needs review"],
  ["review needed", "Needs review"], ["manual review", "Needs review"],
]);

export function normalizeBlastClassification(value: string): string | null {
  const label = String(value || "").trim();
  if (blastClassificationLabels.has(label)) return label;
  const normalized = label.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return blastClassificationAliases.get(normalized) || null;
}

export function normalizeReviewStatus(classification: string): string {
  return classification === "Needs review" ? "Review needed" : "Auto-classified";
}

export function normalizeServiceRelevance(value: string): string {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const map = new Map<string, string>([
    ["promoted service", "Promoted service"], ["same service", "Promoted service"],
    ["different service", "Different service"], ["other service", "Different service"],
    ["unclear", "Unclear"], ["unknown", "Unclear"],
  ]);
  return map.get(normalized) || "Unclear";
}

export function clampConfidence(value: any): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export function confidenceForClassification(classification: string): number {
  const map: Record<string, number> = { Positive: 0.78, Neutral: 0.52, Negative: 0.78, "Opt-out": 0.82, "Needs review": 0.35 };
  return map[classification] || 0.5;
}

export function summaryForConversation(classification: string): string {
  const map: Record<string, string> = {
    Positive: "The post-blast conversation shows customer interest or a request to continue.",
    Neutral: "The post-blast conversation neither clearly accepts nor rejects the promoted offer, or it concerns a different service.",
    Negative: "The post-blast conversation clearly declines or rejects the promoted offer.",
    "Opt-out": "The post-blast conversation contains an explicit request to stop contact.",
    "Needs review": "The post-blast conversation lacks enough usable customer text for a reliable classification.",
  };
  return map[classification] || "";
}

// ---------------------------------------------------------------------------
// Rule fallback
// ---------------------------------------------------------------------------

export function ruleBasedBlastAnalysis(ruleResult: RuleResult, aiConfig: BlastAiConfig) {
  const classification = ruleResult.classification;
  return {
    classification,
    summary: summaryForConversation(classification),
    evidence: sanitizeApiDetail(ruleResult.evidenceText || ""),
    serviceRelevance: "Unclear",
    relevanceReason: "Rule fallback could not reliably determine whether the customer discussed the promoted service.",
    confidence: confidenceForClassification(classification),
    reviewStatus: classification === "Needs review" ? "Review needed" : "Auto-classified",
    analysisMethod: aiConfig.apiKey ? "Rules fallback" : "Rules",
    analysisNote: aiConfig.apiKey ? "" : "OpenAI API key is not configured.",
  };
}

// ---------------------------------------------------------------------------
// Prompts + schema
// ---------------------------------------------------------------------------

function blastReplySystemPrompt(): string {
  return [
    "You classify the customer's overall intent toward the specific promoted offer across a complete post-blast HighLevel conversation for an internal Lead Hero health check.",
    "Return only structured JSON. Do not recommend sending messages, updating contacts, changing opportunities, or triggering workflows.",
    "The promotedOffer field contains the actual matched outbound blast. The blastAnchorPhrase was used only to locate that outbound message and is not the full offer.",
    "Treat postBlastConversation as the primary evidence and consider the entire trajectory of inbound customer messages, not only the latest reply.",
    "Outbound messages provide context and must never be treated as customer intent.",
    "Use semantic and emotional intelligence rather than a fixed keyword list. Consider questions, hesitation, objections, follow-through, and changes in intent across the conversation.",
    "Opt-out takes precedence only when an inbound customer message explicitly asks not to be contacted, removed, unsubscribed, or contains a standalone STOP instruction. Normal phrases such as 'stop by tomorrow' are not opt-outs.",
    "Identify the service or services promoted in promotedOffer, then identify which service or services the customer is discussing.",
    "Set serviceRelevance to Promoted service when the customer is engaging with a service in the promoted offer, Different service when the customer's only expressed interest concerns another service, and Unclear when the service cannot be determined.",
    "Positive means the customer shows genuine interest in the promoted service, requests its pricing or details, asks a relevant service question, requests next steps, or indicates willingness to visit, book, or continue for that promoted service.",
    "Negative means the customer clearly declines or rejects the promoted offer or explicitly says they have no interest in it.",
    "Neutral means the customer is understandable but shows neither clear acceptance nor clear rejection of the promoted offer. Different-service-only inquiries are Neutral for this blast because they do not accept or reject the promoted offer. Also treat temporary deferrals such as not ready right now or maybe later, acknowledgements such as okay or thanks, and identity questions such as who is this as Neutral unless the wider conversation clearly supports another label.",
    "Needs review is exceptional. Use it only when there is no usable inbound customer text, the only evidence is a call record without text intent, or the conversation is genuinely irreconcilable after reading all messages.",
    "Do not use Needs review merely because a message is short, cautious, informal, or requires ordinary contextual judgment.",
    "The summary, evidence, and relevanceReason must describe the customer's overall post-blast intent without copying sensitive contact data. Evidence must cite inbound customer language, not outbound blast copy.",
  ].join(" ");
}

function blastReplyRelaxedSystemPrompt(): string {
  return [
    blastReplySystemPrompt(),
    "Return a single JSON object with exactly these keys: classification, serviceRelevance, relevanceReason, summary, evidence, confidence, reviewStatus.",
    "Do not wrap the JSON in markdown.",
  ].join(" ");
}

function blastReplyUserContent({ phrase, promotedOffer, thread = [] }: { phrase: string; promotedOffer: string; thread: any[] }): string {
  const postBlastConversation = thread.map((m) => ({
    direction: m.direction, time: m.time, channel: m.channel, text: truncateForAi(m.text, 4000),
  }));
  return JSON.stringify({
    task: "Classify the customer's overall intent toward the promotedOffer across the complete postBlastConversation.",
    payloadFormat: "structured-json",
    blastAnchorPhrase: phrase || "",
    promotedOffer: truncateForAi(promotedOffer, 6000),
    postBlastConversation,
    contextNote: "The array begins with the matched outbound blast and includes every exported message from that blast onward in the selected date range. Analyze all inbound customer messages together; outbound messages are context only. A different-service-only inquiry is Neutral for this promoted offer because it neither accepts nor rejects the offer.",
  });
}

function blastReplyJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["classification", "serviceRelevance", "relevanceReason", "summary", "evidence", "confidence", "reviewStatus"],
    properties: {
      classification: { type: "string", enum: ["Positive", "Neutral", "Negative", "Opt-out", "Needs review"] },
      serviceRelevance: { type: "string", enum: ["Promoted service", "Different service", "Unclear"] },
      relevanceReason: { type: "string" },
      summary: { type: "string" },
      evidence: { type: "string" },
      confidence: { type: "number" },
      reviewStatus: { type: "string", enum: ["Auto-classified", "Review needed"] },
    },
  };
}

// ---------------------------------------------------------------------------
// Response parsing helpers
// ---------------------------------------------------------------------------

export function hasValidAiClassification(parsed: any): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  if (Boolean(normalizeBlastClassification((parsed as any).classification))) return true;
  for (const value of Object.values(parsed) as any[]) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (normalizeBlastClassification(value.classification)) return true;
    }
  }
  return false;
}

function flattenAiClassificationObject(obj: any): any {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  if (obj.classification) return obj;
  for (const value of Object.values(obj) as any[]) {
    if (value && typeof value === "object" && !Array.isArray(value) && value.classification) return value;
  }
  return obj;
}

function extractChatCompletionText(payload: any): string {
  const message = payload?.choices?.[0]?.message || {};
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((i: any) => i.text || i.content || "").filter(Boolean).join("\n").trim();
  return "";
}

function extractChatCompletionJson(payload: any): any {
  const message = payload?.choices?.[0]?.message || {};
  if (message.parsed && typeof message.parsed === "object") return flattenAiClassificationObject(message.parsed);
  if (message.refusal) return null;
  const content = message.content;
  if (content && typeof content === "object" && !Array.isArray(content)) return flattenAiClassificationObject(content);
  const parsed = parseJsonObject(extractChatCompletionText(payload));
  if (parsed) return flattenAiClassificationObject(parsed);
  return null;
}

function isOpenRouterParameterRoutingIssue(reason = ""): boolean {
  const clean = String(reason).toLowerCase();
  return clean.includes("no endpoints found") || clean.includes("requested parameters") || clean.includes("provider routing");
}

export function openAiFallbackReason(error: any, aiConfig: BlastAiConfig): string {
  const label = aiConfig.provider === "openrouter" ? "OpenRouter" : "OpenAI";
  if (error?.fallbackReason) return error.fallbackReason;
  if (error?.name === "TimeoutError" || String(error?.message || "").toLowerCase().includes("timeout")) return `${label} request timed out.`;
  if (String(error?.message || "").includes("fetch failed")) return `${label} request could not reach the API.`;
  return `${label} classification did not complete.`;
}

// ---------------------------------------------------------------------------
// AI request
// ---------------------------------------------------------------------------

async function requestAiClassification(
  aiConfig: BlastAiConfig,
  { phrase, promotedOffer, thread = [] }: { phrase: string; promotedOffer: string; thread: any[] },
): Promise<any> {
  const schema = blastReplyJsonSchema();
  const label = aiConfig.provider === "openrouter" ? "OpenRouter" : "OpenAI";

  if (aiConfig.provider === "openrouter") {
    const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${aiConfig.apiKey}` };
    const referer = process.env["OPENROUTER_SITE_URL"] || process.env["APP_URL"] || "";
    const appName = process.env["OPENROUTER_APP_NAME"] || "Lead Hero Health Check Tool";
    if (referer) headers["HTTP-Referer"] = referer;
    if (appName) { headers["X-Title"] = appName; headers["X-OpenRouter-Title"] = appName; }

    const strictBody = {
      model: aiConfig.model,
      messages: [
        { role: "system", content: blastReplySystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "blast_reply_classification", strict: true, schema } },
      provider: { require_parameters: true },
      temperature: 0, max_tokens: 1500,
    };
    const relaxedBody = {
      model: aiConfig.model,
      messages: [
        { role: "system", content: blastReplyRelaxedSystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) },
      ],
      response_format: { type: "json_object" },
      temperature: 0, max_tokens: 1500,
    };

    const requestOpenRouter = async (body: any) => {
      const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        const errorText = await response.text();
        const parsed = parseJsonObject(errorText);
        const detail = sanitizeApiDetail(parsed?.error?.message || errorText);
        const error: any = new Error(`${label} classification failed with ${response.status}`);
        if (response.status === 400) error.fallbackReason = `${label} rejected the classification request.${detail ? ` ${detail}` : ""}`;
        else if (response.status === 401) error.fallbackReason = `${label} API key was rejected.`;
        else if (response.status === 404) error.fallbackReason = `${label} model was not found.${detail ? ` ${detail}` : ""}`;
        else if (response.status === 429) error.fallbackReason = `${label} returned a 429 limit response.${detail ? ` ${detail}` : ""}`;
        else if (response.status >= 500) error.fallbackReason = `${label} API returned a server error.`;
        else error.fallbackReason = `${label} request failed with status ${response.status}.${detail ? ` ${detail}` : ""}`;
        throw error;
      }
      const rawText = await response.text();
      return extractChatCompletionJson(parseJsonMaybe(rawText));
    };

    try {
      const strictParsed = await requestOpenRouter(strictBody);
      if (hasValidAiClassification(strictParsed)) return strictParsed;
    } catch (error) {
      if (!isOpenRouterParameterRoutingIssue(openAiFallbackReason(error, aiConfig))) throw error;
    }
    const relaxedParsed = await requestOpenRouter(relaxedBody);
    if (hasValidAiClassification(relaxedParsed)) return relaxedParsed;
    const plainBody = {
      model: aiConfig.model,
      messages: [
        { role: "system", content: blastReplyRelaxedSystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) },
      ],
      temperature: 0, max_tokens: 1500,
    };
    try {
      const plainParsed = await requestOpenRouter(plainBody);
      if (hasValidAiClassification(plainParsed)) return plainParsed;
    } catch {
      // ignore
    }
    const error: any = new Error(`${label} returned an invalid classification response.`);
    error.fallbackReason = `${label} returned an invalid classification response.`;
    throw error;
  }

  // OpenAI Responses API
  const response = await fetch(`${aiConfig.baseUrl}/responses`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${aiConfig.apiKey}` },
    body: JSON.stringify({
      model: aiConfig.model,
      input: [
        { role: "system", content: blastReplySystemPrompt() },
        { role: "user", content: blastReplyUserContent({ phrase, promotedOffer, thread }) },
      ],
      text: { format: { type: "json_schema", name: "blast_reply_classification", strict: true, schema } },
      max_output_tokens: 1500,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error: any = new Error(`${label} classification failed with ${response.status}`);
    error.fallbackReason = `${label} request failed with status ${response.status}.`;
    throw error;
  }
  const data = await response.json();
  const text = typeof data?.output_text === "string"
    ? data.output_text
    : (data?.output || []).flatMap((item: any) => item.content || []).map((c: any) => c.text || "").join("\n").trim();
  return parseJsonObject(text);
}

// ---------------------------------------------------------------------------
// Top-level classifier
// ---------------------------------------------------------------------------

import type { RuleResult } from "./blast-rules.server";
import { applyBlastClassificationGuards, classifyConversationByRules } from "./blast-rules.server";

export async function classifyBlastReplyWithAi({
  phrase, promotedOffer, thread = [],
  dndStatus = { isDnd: false, channel: "SMS", source: "none" }, aiConfig,
}: {
  phrase: string;
  promotedOffer: string;
  thread: any[];
  dndStatus?: { isDnd: boolean; channel: string; source: string };
  aiConfig: BlastAiConfig;
}): Promise<{
  classification: string;
  summary: string;
  evidence: string;
  serviceRelevance: string;
  relevanceReason: string;
  confidence: number;
  reviewStatus: string;
  analysisMethod: string;
  analysisNote: string;
}> {
  if (dndStatus.isDnd) {
    return {
      classification: "Opt-out",
      summary: "HighLevel marks this contact as Do Not Disturb for the blast channel.",
      evidence: `HighLevel reports Do Not Disturb for ${dndStatus.channel}.`,
      serviceRelevance: "Unclear",
      relevanceReason: "HighLevel DND takes precedence over offer-relevance classification.",
      confidence: 0.99,
      reviewStatus: "Auto-classified",
      analysisMethod: "HighLevel DND",
      analysisNote: "",
    };
  }

  const ruleResult = classifyConversationByRules(thread);
  const fallback = ruleBasedBlastAnalysis(ruleResult, aiConfig);
  if (!aiConfig.apiKey || ruleResult.classification === "Needs review") return fallback;

  try {
    const parsed = await requestAiClassification(aiConfig, { phrase, promotedOffer, thread });
    const classification = normalizeBlastClassification(parsed?.classification);
    if (!classification) {
      const error: any = new Error("AI returned an invalid classification response.");
      error.fallbackReason = "AI returned an invalid classification response.";
      throw error;
    }
    const confidence = parsed?.confidence === undefined || parsed?.confidence === null
      ? confidenceForClassification(classification)
      : clampConfidence(parsed.confidence);
    const serviceRelevance = normalizeServiceRelevance(parsed?.serviceRelevance);
    const finalClassification = applyBlastClassificationGuards({ classification, serviceRelevance, ruleResult });
    const finalConfidence = finalClassification !== classification ? confidenceForClassification(finalClassification) : confidence;
    const reviewStatus = normalizeReviewStatus(finalClassification);
    const adjusted = finalClassification !== classification;

    return {
      classification: finalClassification,
      summary: adjusted ? summaryForConversation(finalClassification) : sanitizeApiDetail(parsed?.summary || summaryForConversation(finalClassification)),
      evidence: adjusted ? fallback.evidence : sanitizeApiDetail(parsed?.evidence || fallback.evidence),
      serviceRelevance,
      relevanceReason: sanitizeApiDetail(
        parsed?.relevanceReason ||
          (serviceRelevance === "Different service"
            ? "The customer discussed a service other than the one promoted in the matched blast."
            : "The service relationship was not explicitly explained."),
      ),
      confidence: finalConfidence,
      reviewStatus,
      analysisMethod: adjusted ? "AI + validation" : "AI",
      analysisNote: adjusted
        ? serviceRelevance === "Different service"
          ? `Adjusted from ${classification} because the customer discussed only a different service from the promoted offer.`
          : `Adjusted from ${classification} using the complete-conversation classification policy.`
        : "",
    };
  } catch (error) {
    return {
      ...fallback,
      reviewStatus: fallback.classification === "Needs review" ? "Review needed" : "Auto-classified (rules fallback)",
      analysisNote: openAiFallbackReason(error, aiConfig),
    };
  }
}