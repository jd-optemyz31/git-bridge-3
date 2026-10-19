import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppUser = {
  id: string;
  email: string | null;
  role: "admin" | "user" | null;
  active: boolean;
};

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = context.claims?.email ?? null;
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: profile } = await context.supabase
      .from("app_users")
      .select("active")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      id: context.userId,
      email,
      role: (roleRow?.role as AppUser["role"]) ?? null,
      active: profile?.active ?? true,
    } satisfies AppUser;
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin-only: enforce server-side.
    const { data: myRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (myRole?.role !== "admin") {
      throw new Error("Forbidden: admin role required");
    }
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const { data: profiles } = await context.supabase
      .from("app_users")
      .select("user_id, email, active, created_at");
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    return (profiles ?? []).map((p) => ({
      id: p.user_id,
      email: p.email,
      role: (roleMap.get(p.user_id) as AppUser["role"]) ?? null,
      active: p.active,
      created_at: p.created_at,
    }));
  });
