import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, ClipboardCheck } from "lucide-react";
import { listClients } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/monthly-check")({
  head: () => ({
    meta: [
      { title: "Monthly Check — Lead Hero Health Check" },
      { name: "description", content: "Generate a Lead Hero maintenance report." },
    ],
  }),
  component: MonthlyCheckPage,
});

function MonthlyCheckPage() {
  const listFn = useServerFn(listClients);
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listFn,
  });
  const [clientId, setClientId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Monthly Check</h1>
        <p className="text-sm text-muted-foreground">
          Generate the required Lead Hero maintenance report.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run a check</CardTitle>
          <CardDescription>Select a client and date range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="c">Client</Label>
                <select
                  id="c"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s">Start date</Label>
                <Input
                  id="s"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e">End date</Label>
                <Input id="e" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          )}
          <Button
            disabled={!clientId || !start || !end}
            onClick={() => toast.info("Live HighLevel data pull is wired in the next phase.")}
          >
            <ClipboardCheck className="mr-1.5 h-4 w-4" /> Run Monthly Check
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report preview</CardTitle>
          <CardDescription>
            The generated ClickUp comment and traffic light appear here after a run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">Not run</Badge>
            Run a check to see the traffic light, evidence sections, and ClickUp comment.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
