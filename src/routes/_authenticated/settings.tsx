import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/users.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Lead Hero Health Check" },
      { name: "description", content: "Account controls and connection status." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const getFn = useServerFn(getCurrentUser);
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getFn,
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const changeMutation = useMutation({
    mutationFn: async () => {
      if (!next || next.length < 8) throw new Error("New password must be at least 8 characters.");
      if (next !== confirm) throw new Error("New passwords do not match.");
      if (!current) throw new Error("Enter your current password.");

      // Re-verify the current password before allowing a change.
      const { data: me } = await supabase.auth.getUser();
      if (!me.user?.email) throw new Error("Session expired — sign in again.");
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: me.user.email,
        password: current,
      });
      if (signInErr) throw new Error("Current password is incorrect.");

      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) throw new Error(updErr.message);
    },
    onSuccess: () => {
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account controls and safe connection status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your current session.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{me?.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge variant={me?.role === "admin" ? "default" : "secondary"}>
                  {me?.role ?? "none"}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={me?.active ? "default" : "secondary"}>
                  {me?.active ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Enter your current password to verify, then choose a new one (min 8 characters).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              changeMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={changeMutation.isPending}>
              {changeMutation.isPending ? "Saving…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection status</CardTitle>
          <CardDescription>Safe integration status — no secrets shown.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">HighLevel</dt>
            <dd>
              <Badge variant="secondary">Read-only</Badge>
            </dd>
            <dt className="text-muted-foreground">ClickUp</dt>
            <dd>
              <Badge variant="secondary">Comment posting</Badge>
            </dd>
            <dt className="text-muted-foreground">AI classification</dt>
            <dd>
              <Badge variant="secondary">Not configured</Badge>
            </dd>
            <dt className="text-muted-foreground">Authentication</dt>
            <dd>
              <Badge variant="default">Email/password</Badge>
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
