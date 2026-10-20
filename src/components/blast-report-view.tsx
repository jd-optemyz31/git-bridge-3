import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BlastReply } from "@/lib/blast.functions";

export type BlastReportViewData = {
  clientName: string;
  dateStart: string;
  dateEnd: string;
  replyTag: string;
  messagePhrase: string;
  analysisMethod: string | null;
  summary: string | null;
  taggedContactCount: number;
  totalRepliedContacts: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  optOutCount: number;
  needsReviewCount: number;
  replies: BlastReply[];
};

export function BlastReportView({ report }: { report: BlastReportViewData }) {
  const stats: { label: string; value: number; tone: string }[] = [
    { label: "Tagged contacts", value: report.taggedContactCount, tone: "text-foreground" },
    { label: "Replied", value: report.totalRepliedContacts, tone: "text-foreground" },
    { label: "Positive", value: report.positiveCount, tone: "text-emerald-600" },
    { label: "Neutral", value: report.neutralCount, tone: "text-muted-foreground" },
    { label: "Negative", value: report.negativeCount, tone: "text-rose-600" },
    { label: "Opt-out", value: report.optOutCount, tone: "text-amber-600" },
    { label: "Needs review", value: report.needsReviewCount, tone: "text-sky-600" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Report summary
          </CardTitle>
          <CardDescription>
            {report.clientName} · {report.dateStart} → {report.dateEnd}
            {report.analysisMethod ? ` · ${report.analysisMethod}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-muted/40 p-3">
                <div className={`text-2xl font-semibold ${s.tone}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Reply tag: </span>
              <span className="font-medium">{report.replyTag}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Blast phrase: </span>
              <span className="font-medium">{report.messagePhrase}</span>
            </div>
          </div>
          {report.summary && <p className="text-sm text-muted-foreground">{report.summary}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classified replies</CardTitle>
          <CardDescription>
            {report.replies.length} contact{report.replies.length === 1 ? "" : "s"} reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.replies.length === 0 ? (
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
                {report.replies.map((r: BlastReply) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.contactName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.lastReplyDate ? new Date(r.lastReplyDate).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <ClassificationBadge value={r.classification} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.analysisMethod || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—"}
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
