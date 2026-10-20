import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getBootstrapStatus,
  seedInitialUsers,
  resetBootstrapPasswords,
} from "@/lib/bootstrap.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lead Hero Health Check" },
      { name: "description", content: "Sign in to the Lead Hero Health Check Tool." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const statusFn = useServerFn(getBootstrapStatus);
  const seedFn = useServerFn(seedInitialUsers);
  const { data: bootstrap } = useQuery({
    queryKey: ["bootstrap-status"],
    queryFn: statusFn,
  });
  const seedMutation = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["bootstrap-status"] });
      toast.success("Initial accounts created — temp passwords shown below.");
      setSeededPasswords(res.created);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [seededPasswords, setSeededPasswords] = useState<
    { email: string; role: string; password: string }[]
  >([]);

  const resetFn = useServerFn(resetBootstrapPasswords);
  const resetMutation = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: (res) => {
      toast.success("Passwords regenerated — new temp passwords shown below.");
      setResetPasswords(res.reset);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [resetPasswords, setResetPasswords] = useState<
    { email: string; role: string; password: string }[]
  >([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/clients" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/clients" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-gold text-charcoal">
            <span className="text-xl font-bold">LH</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Lead Hero Health Check</h1>
          <p className="mt-1 text-sm text-white/60">Sign in to your account</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>No public sign-up. Accounts are created by an Admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Locked out? Contact your Admin.
              </p>
            </form>
          </CardContent>
        </Card>

        {!bootstrap?.seeded && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">No accounts yet</CardTitle>
              <CardDescription>
                Auth accounts can't be migrated via SQL. Create the initial admin + user accounts
                once, then sign in and change passwords.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                disabled={seedMutation.isPending}
                onClick={() => seedMutation.mutate()}
              >
                {seedMutation.isPending ? "Creating accounts…" : "Bootstrap initial accounts"}
              </Button>
              {seededPasswords.length > 0 && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="mb-2 font-medium">
                    Temporary passwords (change after first sign-in):
                  </p>
                  <ul className="space-y-1">
                    {seededPasswords.map((p) => (
                      <li key={p.email} className="font-mono text-xs">
                        {p.email} · {p.role} · <span className="font-semibold">{p.password}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {bootstrap?.seeded && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Locked out?</CardTitle>
              <CardDescription>
                Regenerate temporary passwords for the existing accounts. Use once to get back in,
                then change passwords after sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                disabled={resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
              >
                {resetMutation.isPending ? "Regenerating…" : "Regenerate passwords"}
              </Button>
              {resetPasswords.length > 0 && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="mb-2 font-medium">
                    New temporary passwords (change after sign-in):
                  </p>
                  <ul className="space-y-1">
                    {resetPasswords.map((p) => (
                      <li key={p.email} className="font-mono text-xs">
                        {p.email} · {p.role} · <span className="font-semibold">{p.password}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
