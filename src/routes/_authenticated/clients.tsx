import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Search, Pencil, Unplug, Loader2 } from "lucide-react";
import {
  listClients,
  upsertClient,
  disconnectClient,
  type ClientRow,
} from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Lead Hero Health Check" },
      { name: "description", content: "Manage client account connections." },
    ],
  }),
  component: ClientsPage,
});

const TIMEZONES =
  typeof Intl !== "undefined" && "supportedValuesOf" in Intl
    ? ((Intl as any).supportedValuesOf("timeZone") as string[])
    : [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Europe/London",
        "UTC",
      ];

function ClientsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listClients);
  const upsertFn = useServerFn(upsertClient);
  const disconnectFn = useServerFn(disconnectClient);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: listFn,
  });
  const [search, setSearch] = useState("");

  const upsertMutation = useMutation({
    mutationFn: (v: FormValues) => upsertFn({ data: v }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => disconnectFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("HighLevel token removed from this tool");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (clients ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.ghl_location_id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage client account connections and HighLevel tokens.
          </p>
        </div>
        <ClientFormDialog
          onSave={(v) => upsertMutation.mutate(v)}
          loading={upsertMutation.isPending}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading clients…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {clients && clients.length === 0
                ? "Add your first client to start running Lead Hero health checks."
                : "No clients match your search."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Location ID</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.ghl_location_id}
                    </TableCell>
                    <TableCell className="text-sm">{c.timezone}</TableCell>
                    <TableCell>
                      {c.has_token ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/15">
                          Connected {c.token_preview ? `· ${c.token_preview}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Missing token</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <ClientFormDialog
                          client={c}
                          onSave={(v) => upsertMutation.mutate(v)}
                          loading={upsertMutation.isPending}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                            </Button>
                          }
                        />
                        {c.has_token && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Unplug className="mr-1.5 h-3.5 w-3.5" /> Disconnect
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Disconnect HighLevel?</DialogTitle>
                                <DialogDescription>
                                  This removes the saved HighLevel token from the Health Check Tool
                                  only. It does not change, revoke, or delete anything inside
                                  HighLevel. Client setup, routing, reports, and the ClickUp task ID
                                  remain.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button
                                    variant="destructive"
                                    onClick={() => disconnectMutation.mutate(c.id)}
                                  >
                                    Disconnect
                                  </Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
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

type FormValues = {
  id?: string;
  name: string;
  ghl_location_id: string;
  ghl_private_integration_token?: string;
  clickup_task_id?: string;
  timezone: string;
  form_lead_tag: string;
  active_pipeline_name?: string;
  active_pipeline_id?: string;
  reply_stage_name?: string;
  reply_stage_id?: string;
  reply_stage_window_hours: number;
};

function ClientFormDialog({
  client,
  onSave,
  loading,
  trigger,
}: {
  client?: ClientRow;
  onSave: (v: FormValues) => void;
  loading: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormValues>({
    name: client?.name ?? "",
    ghl_location_id: client?.ghl_location_id ?? "",
    ghl_private_integration_token: "",
    clickup_task_id: client?.clickup_task_id ?? "",
    timezone: client?.timezone ?? "America/New_York",
    form_lead_tag: client?.form_lead_tag ?? "form lead",
    active_pipeline_name: client?.active_pipeline_name ?? "",
    active_pipeline_id: client?.active_pipeline_id ?? "",
    reply_stage_name: client?.reply_stage_name ?? "",
    reply_stage_id: client?.reply_stage_id ?? "",
    reply_stage_window_hours: client?.reply_stage_window_hours ?? 1,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: FormValues = { ...form };
    if (client) payload.id = client.id;
    onSave(payload);
    setOpen(false);
  }

  const defaultTrigger = (
    <Button>
      <Plus className="mr-1.5 h-4 w-4" /> Add Client
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Edit client" : "Add client"}</DialogTitle>
          <DialogDescription>
            {client
              ? "Leave the token field blank to keep the saved token."
              : "Enter the client's HighLevel connection details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Client name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc">HighLevel location ID</Label>
            <Input
              id="loc"
              required
              value={form.ghl_location_id}
              onChange={(e) => setForm({ ...form, ghl_location_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pit">
              HighLevel Private Integration Token
              {client && (
                <span className="ml-1 text-xs text-muted-foreground">(optional on edit)</span>
              )}
            </Label>
            <Input
              id="pit"
              type="password"
              required={!client}
              value={form.ghl_private_integration_token}
              onChange={(e) => setForm({ ...form, ghl_private_integration_token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Use a read-only HighLevel Private Integration Token.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tz">Timezone</Label>
              <select
                id="tz"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clickup">ClickUp task ID</Label>
              <Input
                id="clickup"
                value={form.clickup_task_id}
                onChange={(e) => setForm({ ...form, clickup_task_id: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flt">Form lead tag</Label>
              <Input
                id="flt"
                value={form.form_lead_tag}
                onChange={(e) => setForm({ ...form, form_lead_tag: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window">Reply window (hours)</Label>
              <Input
                id="window"
                type="number"
                min={0}
                value={form.reply_stage_window_hours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reply_stage_window_hours: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apn">Active pipeline name</Label>
              <Input
                id="apn"
                value={form.active_pipeline_name}
                onChange={(e) => setForm({ ...form, active_pipeline_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apid">Active pipeline ID</Label>
              <Input
                id="apid"
                value={form.active_pipeline_id}
                onChange={(e) => setForm({ ...form, active_pipeline_id: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rsn">First-reply stage name</Label>
              <Input
                id="rsn"
                value={form.reply_stage_name}
                onChange={(e) => setForm({ ...form, reply_stage_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rsid">First-reply stage ID</Label>
              <Input
                id="rsid"
                value={form.reply_stage_id}
                onChange={(e) => setForm({ ...form, reply_stage_id: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {client ? "Save changes" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
