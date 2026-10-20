import { createServerFn } from "@tanstack/react-start";

// One-time bootstrap for the initial auth accounts. Auth accounts cannot be
// migrated via SQL (no password hash copy), so they are created here through
// the Auth Admin API. Idempotent: refuses once app_users is non-empty, so it
// is a safe no-op on the published site after seeding.
//
// resetBootstrapPasswords is the recovery path for a locked-out owner during
// bootstrap: it rotates every existing account's password to a fresh random
// value and returns the new passwords. Bootstrap-only — remove once the owner
// has signed in and set known passwords.

const SEED_USERS = [
  { email: "adsupport@optemyz.com", role: "admin" as const },
  { email: "iamjawwad31@gmail.com", role: "user" as const },
];

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let p = "";
  for (let i = 0; i < 18; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

export const getBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("app_users")
    .select("*", { count: "exact", head: true });
  return { seeded: (count ?? 0) > 0 };
});

export const seedInitialUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { count } = await supabaseAdmin
    .from("app_users")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    throw new Error("Already seeded — manage accounts from the Cloud users tab.");
  }

  const created: { email: string; role: string; password: string }[] = [];
  for (const u of SEED_USERS) {
    const password = randomPassword();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Failed to create ${u.email}: ${error?.message ?? "unknown"}`);
    }
    const userId = data.user.id;

    const { error: profileErr } = await supabaseAdmin
      .from("app_users")
      .insert({ user_id: userId, email: u.email, active: true });
    if (profileErr) throw new Error(`app_users insert failed: ${profileErr.message}`);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: u.role });
    if (roleErr) throw new Error(`user_roles insert failed: ${roleErr.message}`);

    created.push({ email: u.email, role: u.role, password });
  }
  return { created };
});

export const resetBootstrapPasswords = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: users, error: usersErr } = await supabaseAdmin
    .from("app_users")
    .select("user_id, email");
  if (usersErr) throw new Error(`Failed to load app_users: ${usersErr.message}`);
  if (!users || users.length === 0) {
    throw new Error("No accounts found — use Bootstrap initial accounts first.");
  }

  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
  const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role] as const));

  const reset: { email: string; role: string; password: string }[] = [];
  for (const u of users) {
    const password = randomPassword();
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(u.user_id, {
      password,
    });
    if (updErr) throw new Error(`Failed to reset ${u.email}: ${updErr.message}`);
    reset.push({ email: u.email, role: (roleMap.get(u.user_id) as string) ?? "user", password });
  }
  return { reset };
});
