import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptToken } from "./blast-helpers.server";

export type ClientRow = {
  id: string;
  name: string;
  ghl_location_id: string;
  clickup_task_id: string | null;
  timezone: string;
  form_lead_tag: string;
  active_pipeline_name: string | null;
  active_pipeline_id: string | null;
  reply_stage_name: string | null;
  reply_stage_id: string | null;
  reply_stage_window_hours: number;
  status: string;
  has_token: boolean;
  token_preview: string | null;
  created_at: string;
  updated_at: string;
};

function rowToClient(r: any): ClientRow {
  return {
    id: r.id,
    name: r.name,
    ghl_location_id: r.ghl_location_id,
    clickup_task_id: r.clickup_task_id,
    timezone: r.timezone,
    form_lead_tag: r.form_lead_tag,
    active_pipeline_name: r.active_pipeline_name,
    active_pipeline_id: r.active_pipeline_id,
    reply_stage_name: r.reply_stage_name,
    reply_stage_id: r.reply_stage_id,
    reply_stage_window_hours: r.reply_stage_window_hours,
    status: r.status,
    has_token: !!r.ghl_private_integration_token_encrypted,
    token_preview: r.ghl_private_integration_token_preview,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToClient);
  });

const clientInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Client name is required"),
  ghl_location_id: z.string().min(1, "HighLevel location ID is required"),
  ghl_private_integration_token: z.string().optional(),
  clickup_task_id: z.string().optional(),
  timezone: z.string().min(1),
  form_lead_tag: z.string().min(1).default("form lead"),
  active_pipeline_name: z.string().optional(),
  active_pipeline_id: z.string().optional(),
  reply_stage_name: z.string().optional(),
  reply_stage_id: z.string().optional(),
  reply_stage_window_hours: z.number().int().min(0).default(1),
});

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => clientInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rawToken = data.ghl_private_integration_token?.trim();
    const token = rawToken ? encryptToken(rawToken) : "";
    const preview = rawToken ? rawToken.slice(0, 4) + "…" + rawToken.slice(-4) : null;

    const common = {
      name: data.name,
      ghl_location_id: data.ghl_location_id,
      clickup_task_id: data.clickup_task_id || null,
      timezone: data.timezone,
      form_lead_tag: data.form_lead_tag,
      active_pipeline_name: data.active_pipeline_name || null,
      active_pipeline_id: data.active_pipeline_id || null,
      reply_stage_name: data.reply_stage_name || null,
      reply_stage_id: data.reply_stage_id || null,
      reply_stage_window_hours: data.reply_stage_window_hours,
      created_by_user_id: context.userId,
    };

    if (data.id) {
      const update = {
        ...common,
        ...(token
          ? {
              ghl_private_integration_token_encrypted: token,
              ghl_private_integration_token_preview: preview,
              status: "connected" as const,
            }
          : {}),
      };
      const { data: updated, error } = await context.supabase
        .from("clients")
        .update(update)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return rowToClient(updated);
    }

    if (!token) throw new Error("HighLevel PIT token is required when adding a new client");
    const insert = {
      ...common,
      ghl_private_integration_token_encrypted: token,
      ghl_private_integration_token_preview: preview,
      status: "connected" as const,
    };
    const { data: created, error } = await context.supabase
      .from("clients")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToClient(created);
  });

const disconnectSchema = z.object({ id: z.string().uuid() });

export const disconnectClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => disconnectSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({
        ghl_private_integration_token_encrypted: null,
        ghl_private_integration_token_preview: null,
        status: "disconnected",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
