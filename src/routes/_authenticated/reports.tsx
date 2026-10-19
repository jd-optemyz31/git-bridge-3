import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Lead Hero Health Check" },
      { name: "description", content: "View saved monthly reports and blast analyses." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          View saved monthly reports and blast analyses.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> No saved reports yet
          </CardTitle>
          <CardDescription>
            Run a Monthly Check or Blast Analyzer to generate and save reports here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Filters by client, month, and status will appear once reports exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
