import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Bomb } from "lucide-react";
import { listClients } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/blast-analyzer")({
  head: () => ({
    meta: [
      { title: "Blast Analyzer — Lead Hero Health Check" },
      { name: "description", content: "Analyze blast replies anytime." },
    ],
  }),
  component: BlastAnalyzerPage,
});

function BlastAnalyzerPage() {
  const listFn = useServerFn(listClients);
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listFn,
  });
  const [clientId, setClientId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [replyTag, setReplyTag] = useState("Replied to Blast");
  const [phrase, setPhrase] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Blast Analyzer</h1>
        <p className="text-sm text-muted-foreground">
          Analyze blast replies anytime, independent of monthly reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run analysis</CardTitle>
          <CardDescription>
            The blast message phrase is required to anchor the conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
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
                  <Label htmlFor="rt">Reply tag</Label>
                  <Input id="rt" value={replyTag} onChange={(e) => setReplyTag(e.target.value)} />
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
                  <Input id="be" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bp">Blast message phrase (required)</Label>
                  <Input
                    id="bp"
                    placeholder="A distinctive phrase from the outbound blast"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                  />
                </div>
              </div>
              <Button
                disabled={!clientId || !start || !end || !phrase}
                onClick={() =>
                  toast.info("Live HighLevel blast analysis is wired in the next phase.")
                }
              >
                <Bomb className="mr-1.5 h-4 w-4" /> Run Analysis
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            All tagged contacts and reply classifications appear here after a run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No analysis run yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
