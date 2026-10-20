import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getBlastAnalysis } from "@/lib/blast.functions";
import { BlastReportView } from "@/components/blast-report-view";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports/$reportId")({
  head: () => ({
    meta: [
      { title: "Blast Report — Lead Hero Health Check" },
      {
        name: "description",
        content: "Saved Blast Analyzer report with full classified replies.",
      },
      { property: "og:title", content: "Blast Report — Lead Hero Health Check" },
      {
        property: "og:description",
        content: "Saved Blast Analyzer report with full classified replies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportDetailPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Report not found.</p>,
});

function ReportDetailPage() {
  const { reportId } = Route.useParams();
  const getFn = useServerFn(getBlastAnalysis);

  const { data, isLoading, error } = useQuery({
    queryKey: ["blast-report", reportId],
    queryFn: () => getFn({ data: { id: reportId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report…
      </div>
    );
  }

  if (error || !data) {
    throw notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Blast Report</h1>
          <p className="text-sm text-muted-foreground">
            Saved run · {new Date(data.createdAt).toLocaleString()}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/reports">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All reports
          </Link>
        </Button>
      </div>

      <BlastReportView
        report={{
          clientName: data.clientName ?? data.clientId,
          dateStart: data.dateStart,
          dateEnd: data.dateEnd,
          replyTag: data.replyTag,
          messagePhrase: data.messagePhrase,
          analysisMethod: data.analysisMethod,
          summary: data.summary,
          taggedContactCount: data.taggedContactCount,
          totalRepliedContacts: data.totalRepliedContacts,
          positiveCount: data.positiveCount,
          neutralCount: data.neutralCount,
          negativeCount: data.negativeCount,
          optOutCount: data.optOutCount,
          needsReviewCount: data.needsReviewCount,
          replies: data.replies,
        }}
      />
    </div>
  );
}
