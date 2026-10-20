import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bomb, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { listClients } from "@/lib/clients.functions";
import {
  runBlastAnalysis,
  listBlastAnalyses,
  type BlastAnalysis,
  type BlastReply,
  type BlastAnalysisSummary,
} from "@/lib/blast.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/blast-analyzer")({
  head: () => ({
    meta: [
      { title: "Blast Analyzer — Lead Hero Health Check" },
      {
        name: "description",
        content:
          "Run a live, read-only HighLevel blast reply analysis anytime.",
      },
      { property: "og:title", content: "Blast Analyzer — Lead Hero Health Check" },
      {
        property: "og:description",
        content: "Run a live, read-only HighLevel blast reply analysis anytime.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlastAnalyzerPage,
});

function BlastAnalyzerPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listClients);
  const runFn = useServerFn(runBlastAnalysis);
  const listAnalysesFn = useServerFn(listBlastAnalyses);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listFn,
  });

  const [clientId, setClientId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [replyTag, setReplyTag] = useState("Replied to Blast");
  const [phrase, setPhrase] = useState("");
  const [analysis, setAnalysis] = useState<BlastAnalysis | null>(null);

  const selectedClient = (clients ?? []).find((c) => c.id === clientId);

  const { data: recent } = useQuery({
    queryKey: ["blast-analyses", clientId],
    queryFn: () => listAnalysesFn({ data: { clientId } }),
    enabled: !!clientId,
  });

  const runMutation = useMutation({
    mutationFn: () =>
      runFn({
        data: {
          clientId,
          dateStart: start,
          dateEnd: end,
          replyTag,
          messagePhrase: phrase,
        },
      }),
    onSuccess: (res) => {
      setAnalysis(res.analysis);
      queryClient.invalidateQueries({ queryKey: ["blast-analyses", clientId] });
      toast.success("Blast analysis complete.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canRun =
    !!clientId && !!start && !!end && !!phrase && !runMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Blast Analyzer</h1>
        <p className="text-sm text-muted-foreground">
          Run a live, read-only HighLevel blast reply analysis anytime —
          independent of monthly reports.
        </p>
      </div>

      {/* Run form */}
      <Card>
        <CardHeader>
          <CardTitle>Run analysis</CardTitle>
          <CardDescription>
            The blast message phrase anchors each conversation to the outbound
            blast. Pick a connected client, a date range, the reply tag, and the
            phrase to match.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading clients…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bc">Client</Label>
                  <select
                    id="bc"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      setAnalysis(null);
                    }}
                  >
                    <option value="">Select…</option>
                    {(clients ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.has_token ? "" : " · no token"}
                      </option>
                    ))}
                  </select>
                  {selectedClient && !selectedClient.has_token && (
                    <p className="text-xs text-destructive">
                      This client has no connected HighLevel token. Add one on
                      the Clients page first.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rt">Reply tag</Label>
                  <Input
                    id="rt"
                    value={replyTag}
                    onChange={(e) => setReplyTag(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bs">Start date</Label>
                  <Input
                    id="bs"
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="be">End date</Label>
                  <Input
                    id="be"
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bp">Blast message phrase (required)</Label>
                  <Input
                    id="bp"
                    placeholder="A distinctive phrase from the outbound blast"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only contacts tagged with the reply tag whose conversations
                    contain this outbound phrase are classified.
                  </p>
                </div>
              </div>
              <Button
                disabled={!canRun}
                onClick={() => {
                  setAnalysis(null);
                  runMutation.mutate();
                }}
              >
                {runMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Running…
                  </>
                ) : (
                  <>
                    <Bomb className="mr-1.5 h-4 w-4" /> Run Analysis
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Progress while running */}
      {runMutation.isPending && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">
                Running live blast analysis…
              </p>
              <p className="text-xs text-muted-foreground">
                Scanning contacts, exporting conversations, anchoring the blast,
                and classifying replies. This can take a moment for large date
                ranges.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysis && <BlastResults analysis={analysis} />}

      {/* Recent saved analyses */}
      {clientId && (recent ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent analyses</CardTitle>
            <CardDescription>
              Saved runs for this client, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date range</TableHead>
                  <TableHead>Reply tag</TableHead>
                  <TableHead>Tagged</TableHead>
                  <TableHead>Positive</TableHead>
                  <TableHead>Negative</TableHead>
                  <TableHead>Opt-out</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recent ?? []).map((a: BlastAnalysisSummary) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">
                      {a.dateStart} → {a.dateEnd}
                    </TableCell>
                    <TableCell className="text-sm">{a.replyTag}</TableCell>
                    <TableCell className="text-sm">
                      {a.taggedContactCount}
                    </TableCell>
                    <TableCell className="text-sm">{a.positiveCount}</TableCell>
                    <TableCell className="text-sm">{a.negativeCount}</TableCell>
                    <TableCell className="text-sm">{a.optOutCount}</TableCell>
                    <TableCell className="text-sm">
                      {a.needsReviewCount}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BlastResults({ analysis }: { analysis: BlastAnalysis }) {
  const stats: { label: string; value: number; tone: string }[] = [
    { label: "Tagged contacts", value: analysis.taggedContactCount, tone: "text-foreground" },
    { label: "Matched blast", value: analysis.matchedBlastCount, tone: "text-foreground" },
    { label: "Replied", value: analysis.totalRepliedContacts, tone: "text-foreground" },
    { label: "Positive", value: analysis.positiveCount, tone: "text-emerald-600" },
    { label: "Neutral", value: analysis.neutralCount, tone: "text-muted-foreground" },
    { label: "Negative", value: analysis.negativeCount, tone: "text-rose-600" },
    { label: "Opt-out", value: analysis.optOutCount, tone: "text-amber-600" },
    { label: "Needs review", value: analysis.needsReviewCount, tone: "text-sky-600" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Results
          </CardTitle>
          <CardDescription>
            {analysis.clientName} · {analysis.dateStart} → {analysis.dateEnd}
            {analysis.analysisMethod ? ` · ${analysis.analysisMethod}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-border bg-muted/40 p-3"
              >
                <div className={`text-2xl font-semibold ${s.tone}`}>
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{analysis.summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classified replies</CardTitle>
          <CardDescription>
            {analysis.replies.length} contact
            {analysis.replies.length === 1 ? "" : "s"} reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {analysis.replies.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No tagged contacts were found in this date range.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Last reply</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Conf.</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.replies.map((r: BlastReply) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.contactName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.lastReplyDate
                        ? new Date(r.lastReplyDate).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <ClassificationBadge value={r.classification} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.analysisMethod || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {r.confidence != null
                        ? `${Math.round(r.confidence * 100)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">
                      {r.summary}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClassificationBadge({ value }: { value: string }) {
  const variant =
    value === "Positive"
      ? "default"
      : value === "Negative" || value === "Opt-out"
        ? "destructive"
        : value === "Needs review"
          ? "outline"
          : "secondary";
  return <Badge variant={variant as never}>{value}</Badge>;
}