import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { listClients } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/routing")({
  head: () => ({
    meta: [
      { title: "Routing Setup — Lead Hero Health Check" },
      { name: "description", content: "Configure new-lead notification routing." },
    ],
  }),
  component: RoutingPage,
});

function RoutingPage() {
  const listFn = useServerFn(listClients);
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listFn,
  });
  const [clientId, setClientId] = useState<string>("");

  const selected = (clients ?? []).find((c) => c.id === clientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Routing Setup</h1>
        <p className="text-sm text-muted-foreground">
          Configure how the tool verifies internal new-lead notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
          <CardDescription>Select a client to manage its routing setup.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (clients ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet. Add one first.</p>
          ) : (
            <select
              className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client…</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Staff notification contacts — {selected.name}</CardTitle>
            <CardDescription>
              Default expected phrase: <Badge variant="secondary">New form submission</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="scid">Staff contact ID</Label>
                <Input id="scid" placeholder="e.g. abc123" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sph">Staff phone number</Label>
                <Input id="sph" placeholder="+1 555 0100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay">Expected delay (minutes)</Label>
                <Input id="delay" type="number" min={0} defaultValue={0} />
              </div>
            </div>
            <Button onClick={() => toast.info("Routing setup saving is wired in the next phase.")}>
              <Plus className="mr-1.5 h-4 w-4" /> Save routing setup
            </Button>
            <div className="rounded-md border border-dashed p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff contact ID</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Expected phrase</TableHead>
                    <TableHead>Delay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No staff contacts added yet.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
