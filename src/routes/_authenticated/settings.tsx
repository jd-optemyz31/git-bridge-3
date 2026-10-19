import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/users.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
            Self-service password change requires your current password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Password management is wired in the next phase.
          </p>
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
