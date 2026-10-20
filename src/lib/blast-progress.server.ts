// Blast Analyzer — progress reporting + concurrency mapper.
// Pure helpers, safe to import anywhere.

export type BlastProgress = {
  phase: string;
  phaseLabel: string;
  verb: string;
  detail: string;
  percent: number;
  done: number;
  total: number;
  count: number;
};

const classificationVerbs = [
  "[Reading reply intent...]",
  "[Checking service relevance...]",
  "[Weighing conversation signals...]",
  "[Sorting reply sentiment...]",
];

function boundedPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function ratio(done: number, total: number): number {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!safeTotal) return 1;
  return Math.max(0, Math.min(1, (Number(done) || 0) / safeTotal));
}

export function blastProgress(
  phase: string,
  opts: { done?: number; total?: number; count?: number; mode?: string; detail?: string } = {},
): BlastProgress {
  const safeDone = Math.max(0, Number(opts.done) || 0);
  const safeTotal = Math.max(0, Number(opts.total) || 0);
  const safeCount = Math.max(0, Number(opts.count) || 0);
  let percent = 2;
  let verb = "[Calibrating the blast scan...]";
  let phaseLabel = "Preparing";
  let detail = opts.detail || "Preparing a read-only HighLevel analysis.";

  if (phase === "contacts") {
    percent = 5 + Math.min(20, (safeCount / 50_000) * 20);
    verb =
      opts.mode === "cursor"
        ? "[Sweeping contact pages...]"
        : "[Filtering reply-tag candidates...]";
    phaseLabel = "Contact scan";
    detail =
      opts.detail ||
      (opts.mode === "cursor"
        ? `${safeCount.toLocaleString()} contacts inspected with read-only cursor pagination.`
        : `${safeCount.toLocaleString()} reply-tag candidate contacts loaded.`);
  } else if (phase === "messages") {
    percent = 25 + ratio(safeDone, safeTotal) * 25;
    verb = "[Gathering conversation trails...]";
    phaseLabel = "Conversation export";
    detail =
      opts.detail || `${Math.min(safeDone, safeTotal)} of ${safeTotal} date windows exported.`;
  } else if (phase === "matching") {
    percent = 53;
    verb = "[Anchoring outbound blast messages...]";
    phaseLabel = "Blast matching";
    detail =
      opts.detail ||
      `Matching the required phrase for ${safeCount.toLocaleString()} tagged contacts.`;
  } else if (phase === "classifying") {
    percent = 56 + ratio(safeDone, safeTotal) * 39;
    const idx = Math.floor(
      safeDone / Math.max(1, Math.ceil(safeTotal / classificationVerbs.length)),
    );
    verb =
      classificationVerbs[Math.min(classificationVerbs.length - 1, idx)] ??
      classificationVerbs[0] ??
      "";
    phaseLabel = "Reply classification";
    detail =
      opts.detail ||
      (safeTotal
        ? `${Math.min(safeDone, safeTotal).toLocaleString()} of ${safeTotal.toLocaleString()} tagged contacts reviewed.`
        : "No tagged contacts require classification.");
  } else if (phase === "saving") {
    percent = 98;
    verb = "[Polishing the final analysis...]";
    phaseLabel = "Saving";
    detail = opts.detail || "Saving the completed, client-scoped analysis.";
  } else if (phase === "done") {
    percent = 100;
    verb = "[Blast analysis complete.]";
    phaseLabel = "Complete";
    detail = opts.detail || `${safeDone.toLocaleString()} tagged contacts accounted for.`;
  }

  return {
    phase,
    phaseLabel,
    verb,
    detail,
    percent: boundedPercent(percent),
    done: safeDone,
    total: safeTotal,
    count: safeCount,
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const cur = index;
      const item = items[cur];
      if (item === undefined) break;
      index += 1;
      results[cur] = await mapper(item, cur);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
