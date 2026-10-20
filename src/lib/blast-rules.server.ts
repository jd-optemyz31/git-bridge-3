// Blast Analyzer — thread anchoring + rule-based classification.
// Pure logic, ported from the original blast-thread.mjs.
// Safe to import anywhere.

import {
  isCallMessage,
  isInboundMessage,
  isOutboundMessage,
  messageChannel,
  messageContactId,
  messageText,
  messageTimestamp,
  timestampOf,
  valueText,
} from "./blast-helpers.server";

type ThreadMessage = {
  direction: string;
  time: string;
  channel: string;
  text: string;
};

function threadMessageForAi(message: any): ThreadMessage {
  return {
    direction: messageDirectionLabel(message),
    time: messageTimestamp(message),
    channel:
      messageChannel(message) || valueText(message, ["type", "messageType", "message_type"]) || "",
    text: messageText(message),
  };
}

function latestInboundMessage(messages: any[]): any {
  return [...messages].reverse().find((m) => isInboundMessage(m));
}

export function blastThreadForContact(
  messages: any[],
  contactIdValue: string,
  messagePhrase: string,
) {
  const contactMessages = messages
    .filter((m) => messageContactId(m) === contactIdValue)
    .sort((a, b) => timestampOf(a) - timestampOf(b));
  if (!contactMessages.length) {
    return {
      thread: [] as ThreadMessage[],
      latest: undefined,
      latestCandidate: undefined,
      matchedBlast: undefined,
      blastFound: false,
    };
  }
  const usable = contactMessages.filter((m) => {
    const text = messageText(m);
    return text || isCallMessage(m) || isInboundMessage(m) || isOutboundMessage(m);
  });
  const result = selectAnchoredBlastThread(usable, {
    messagePhrase,
    textOf: messageText,
    timestampOf,
    isOutbound: isOutboundMessage,
    isInbound: isInboundMessage,
    toThreadMessage: threadMessageForAi,
  });
  return { ...result, latestCandidate: latestInboundMessage(usable) };
}

export function messageDirectionLabel(message: any): string {
  if (isInboundMessage(message)) return "inbound";
  if (isOutboundMessage(message)) return "outbound";
  return "unknown";
}

export function selectAnchoredBlastThread(
  messages: any[],
  opts: {
    messagePhrase: string;
    textOf: (m: any) => string;
    timestampOf: (m: any) => number;
    isOutbound: (m: any) => boolean;
    isInbound: (m: any) => boolean;
    toThreadMessage: (m: any) => ThreadMessage;
  },
) {
  const phrase = String(opts.messagePhrase || "")
    .trim()
    .toLowerCase();
  if (!phrase || !messages.length) {
    return {
      thread: [] as ThreadMessage[],
      latest: undefined,
      matchedBlast: undefined,
      blastFound: false,
    };
  }
  const blastMessages = [...messages]
    .reverse()
    .filter((m) => opts.isOutbound(m) && opts.textOf(m).toLowerCase().includes(phrase));
  for (const blastMessage of blastMessages) {
    const blastTs = opts.timestampOf(blastMessage);
    const postBlast = messages.filter((m) => {
      const ts = opts.timestampOf(m);
      return !blastTs || !ts || ts >= blastTs;
    });
    const latest = [...postBlast].reverse().find((m) => opts.isInbound(m));
    if (latest) {
      return {
        thread: postBlast.map(opts.toThreadMessage),
        latest,
        matchedBlast: opts.toThreadMessage(blastMessage),
        blastFound: true,
      };
    }
  }
  return {
    thread: [] as ThreadMessage[],
    latest: undefined,
    matchedBlast: blastMessages[0] ? opts.toThreadMessage(blastMessages[0]) : undefined,
    blastFound: blastMessages.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Rule-based classification
// ---------------------------------------------------------------------------

const explicitOptOutPattern =
  /\b(unsubscribe|remove me(?: from (?:this|your) (?:list|messages?))?|do not (?:contact|text|message|call) me|don't (?:contact|text|message|call) me|take me off(?: (?:this|your) (?:list|messages?))?|opt me out|stop (?:texting|messaging|contacting|calling|sending) me|stop (?:all )?(?:messages?|texts?|sms))\b/i;
const temporaryNeutralPattern =
  /\b(not ready(?: right)? now|not now|maybe later|another time|check back later|reach out later)\b/i;
const negativePattern =
  /\b(no thanks|no thank you|not interested|not a fit|no interest|already have|too expensive|pass|do not need|don't need|no longer interested)\b/i;
const positivePattern =
  /\b(yes|sure|sounds good|please send|send me|tell me more|more information|details|pricing|price|quote|cost|how much|call me|book|schedule|next steps?|move forward|proceed|i(?:'m| am) interested|we(?:'re| are) interested|interested in|i(?:'ll| will) stop by|stop by (?:today|tomorrow|later)|come by|drop by|see you (?:today|tomorrow|then))\b/i;
const positiveVisitPattern =
  /\b(i(?:'ll| will) stop by|stop by (?:today|tomorrow|later)|come by|drop by|see you (?:today|tomorrow|then))\b/i;
const explicitNeutralPattern =
  /\b(ok|okay|thanks|thank you|who is this|what is this about|received|got it)\b/i;

function normalizedOptOutText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[.!?,;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function isExplicitOptOutText(text: string): boolean {
  const n = normalizedOptOutText(text);
  if (["stop", "please stop", "stop please"].includes(n)) return true;
  return explicitOptOutPattern.test(n);
}
function latestMatchingText(messages: { text: string }[], pattern: RegExp): string {
  return [...messages].reverse().find((m) => pattern.test(m.text))?.text || "";
}

export type RuleResult = {
  classification: string;
  evidenceText: string;
  signalMatched: boolean;
  signalType: string;
};

export function classifyConversationByRules(thread: ThreadMessage[]): RuleResult {
  const inbound = thread
    .filter((m) => String(m.direction || "").toLowerCase() === "inbound")
    .map((m) => ({
      text: String(m.text || "")
        .replace(/\s+/g, " ")
        .trim(),
      isCall: String(m.channel || "")
        .toLowerCase()
        .includes("call"),
    }));
  const readable = inbound.filter((m) => m.text && !m.isCall);
  if (!readable.length) {
    return {
      classification: "Needs review",
      evidenceText: "",
      signalMatched: false,
      signalType: inbound.some((m) => m.isCall) ? "call-only" : "missing-text",
    };
  }
  const optOut = [...readable].reverse().find((m) => isExplicitOptOutText(m.text))?.text || "";
  if (optOut)
    return {
      classification: "Opt-out",
      evidenceText: optOut,
      signalMatched: true,
      signalType: "opt-out",
    };

  const positiveMessages = readable.filter(
    (m) => positivePattern.test(m.text) && !negativePattern.test(m.text),
  );
  const positiveEvidence = latestMatchingText(positiveMessages, positivePattern);
  if (positiveEvidence) {
    return {
      classification: "Positive",
      evidenceText: positiveEvidence,
      signalMatched: true,
      signalType: positiveVisitPattern.test(positiveEvidence) ? "positive-visit" : "positive",
    };
  }
  const tempNeutral = latestMatchingText(readable, temporaryNeutralPattern);
  if (tempNeutral)
    return {
      classification: "Neutral",
      evidenceText: tempNeutral,
      signalMatched: true,
      signalType: "temporary-neutral",
    };

  const negativeEvidence = latestMatchingText(readable, negativePattern);
  if (negativeEvidence)
    return {
      classification: "Negative",
      evidenceText: negativeEvidence,
      signalMatched: true,
      signalType: "negative",
    };

  const explicitNeutral = latestMatchingText(readable, explicitNeutralPattern);
  if (explicitNeutral)
    return {
      classification: "Neutral",
      evidenceText: explicitNeutral,
      signalMatched: true,
      signalType: "neutral",
    };

  return {
    classification: "Neutral",
    evidenceText: readable.at(-1)?.text || "",
    signalMatched: false,
    signalType: "neutral",
  };
}

// ---------------------------------------------------------------------------
// DND + analysis state + guards
// ---------------------------------------------------------------------------

export function normalizeDndChannel(channel: string): string {
  const n = String(channel || "SMS")
    .replace(/^TYPE_/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  const map: Record<string, string> = {
    sms: "SMS",
    text: "SMS",
    email: "Email",
    call: "Call",
    phone: "Call",
    voicemail: "Voicemail",
    whatsapp: "WhatsApp",
    gmb: "GMB",
    googlemybusiness: "GMB",
    fb: "FB",
    facebook: "FB",
  };
  return map[n] || "SMS";
}

export function contactDndStatus(contact: any, channel = "SMS") {
  const normalizedChannel = normalizeDndChannel(channel);
  if (contact?.dnd === true) return { isDnd: true, channel: normalizedChannel, source: "overall" };
  const settings: Record<string, any> =
    contact?.dndSettings && typeof contact.dndSettings === "object" ? contact.dndSettings : {};
  const entry = Object.entries(settings).find(
    ([k]) => normalizeDndChannel(k) === normalizedChannel,
  )?.[1];
  const status = String(entry?.status || "")
    .trim()
    .toLowerCase();
  const isDnd = status === "active" || status === "permanent";
  return { isDnd, channel: normalizedChannel, source: isDnd ? "channel" : "none" };
}

export function blastContactAnalysisState({
  blastFound,
  latest,
}: {
  blastFound: boolean;
  latest?: any;
}) {
  if (!blastFound) {
    return {
      eligible: false,
      status: "No blast match",
      reason:
        "The contact has the reply tag, but the required outbound blast phrase was not found in the exported date range.",
    };
  }
  if (!latest) {
    return {
      eligible: false,
      status: "No post-blast reply",
      reason:
        "The outbound blast matched, but no later inbound customer message was found in the exported date range.",
    };
  }
  return { eligible: true, status: "Analyzed", reason: "" };
}

export function applyBlastClassificationGuards({
  classification,
  serviceRelevance = "Unclear",
  ruleResult,
}: {
  classification: string;
  serviceRelevance?: string;
  ruleResult: RuleResult;
}): string {
  if (ruleResult.classification === "Opt-out") return "Opt-out";
  if (serviceRelevance === "Different service" && classification !== "Opt-out") return "Neutral";
  if (classification === "Opt-out" && ruleResult.signalType === "positive-visit") return "Positive";
  if (
    serviceRelevance === "Promoted service" &&
    ruleResult.classification === "Positive" &&
    classification !== "Opt-out"
  )
    return "Positive";
  if (classification === "Needs review" && ruleResult.signalMatched)
    return ruleResult.classification;
  if (classification === "Negative" && ruleResult.signalType === "temporary-neutral")
    return "Neutral";
  return classification;
}
