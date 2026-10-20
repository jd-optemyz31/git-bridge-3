import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FileText, Loader2, Search, Trash2 } from "lucide-react";
import {
  listAllBlastAnalyses,
  deleteBlastAnalysis,
  type BlastReportListItem,
} from "@/lib/blast.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Blast Reports — Lead Hero Health Check" },
      {
        name: "description",
        content: "Every saved Blast Analyzer run, stored as a report you can reopen anytime.",
      },
      { property: "og:title", content: "Blast Reports — Lead Hero Health Check" },
      {
        property: "og:description",
        content: "Every saved Blast Analyzer run, stored as a report you can reopen anytime.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAllBlastAnalyses);
  const deleteFn = useServerFn(deleteBlastAnalysis);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["blast-reports"],
    queryFn: listFn,
  });

  const [search, setSearch] = useState("");

  const filtered = (reports ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.clientName ?? "").toLowerCase().includes(q) ||
      r.replyTag.toLowerCase().includes(q) ||
      r.messagePhrase.toLowerCase().includes(q) ||
      `${r.dateStart} → ${r.dateEnd}`.includes(q)
    );
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blast-reports"] });
      queryClient.invalidateQueries({ queryKey: ["blast-analyses"] });
      toast.success("Report deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Blast Reports</h1>
        <p className="text-sm text-muted-foreground">
          Every Blast Analyzer run is saved here as a report. Open any one to revisit the full
          classified replies.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Saved reports
          </CardTitle>
          <CardDescription>
            {(reports ?? []).length} report{(reports ?? []).length === 1 ? "" : "s"} across all
            clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search client, tag, phrase, or date…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading reports…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No reports yet. Run a Blast Analyzer analysis to create one.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/blast-analyzer">Go to Blast Analyzer</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Date range</TableHead>
                    <TableHead>Reply tag</TableHead>
                    <TableHead>Tagged</TableHead>
                    <TableHead>Positive</TableHead>
                    <TableHead>Negative</TableHead>
                    <TableHead>Opt-out</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: BlastReportListItem) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.clientName ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.dateStart} → {r.dateEnd}
                      </TableCell>
                      <TableCell className="text-sm">{r.replyTag}</TableCell>
                      <TableCell className="text-sm">{r.taggedContactCount}</TableCell>
                      <TableCell className="text-sm text-emerald-600">{r.positiveCount}</TableCell>
                      <TableCell className="text-sm text-rose-600">{r.negativeCount}</TableCell>
                      <TableCell className="text-sm text-amber-600">{r.optOutCount}</TableCell>
                      <TableCell className="text-sm text-sky-600">{r.needsReviewCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/reports/$reportId" params={{ reportId: r.id }}>
                              View
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm("Delete this blast report? This cannot be undone.")) {
                                deleteMutation.mutate(r.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
