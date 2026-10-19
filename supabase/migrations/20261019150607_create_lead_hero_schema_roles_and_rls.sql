-- ============================================================
-- Lead Hero Health Check Tool — baseline schema
-- ============================================================

-- Roles & role-check function (platform-mandated pattern)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles
                     WHERE user_id = _user_id AND role = _role) $$;

-- ============================================================
-- app_users: profile mirror keyed by auth.uid()
-- ============================================================
CREATE TABLE public.app_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_users TO authenticated;
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.app_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users insert own profile" ON public.app_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own profile" ON public.app_users
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- clients
-- ============================================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ghl_location_id text NOT NULL,
  ghl_private_integration_token_encrypted text,
  ghl_private_integration_token_preview text,
  clickup_task_id text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  form_lead_tag text NOT NULL DEFAULT 'form lead',
  active_pipeline_name text,
  active_pipeline_id text,
  reply_stage_name text,
  reply_stage_id text,
  reply_stage_window_hours integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'connected',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage clients" ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- routing_setups
-- ============================================================
CREATE TABLE public.routing_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  staff_contact_id text,
  staff_phone_number text,
  expected_phrase text NOT NULL DEFAULT 'New form submission',
  expected_delay_minutes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routing_setups TO authenticated;
GRANT ALL ON public.routing_setups TO service_role;
ALTER TABLE public.routing_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage routing" ON public.routing_setups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- monthly_checks
-- ============================================================
CREATE TABLE public.monthly_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date_start date NOT NULL,
  date_end date NOT NULL,
  status text NOT NULL DEFAULT 'green',
  routing_working text,
  automations_firing text,
  attribution_intact text,
  leads_received integer NOT NULL DEFAULT 0,
  calls_answered integer NOT NULL DEFAULT 0,
  calls_missed integer NOT NULL DEFAULT 0,
  blast_summary_id uuid,
  issues text,
  next_month_focus text,
  generated_comment text,
  posted_to_clickup boolean NOT NULL DEFAULT false,
  clickup_comment_id text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.monthly_checks TO authenticated;
GRANT ALL ON public.monthly_checks TO service_role;
ALTER TABLE public.monthly_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage monthly checks" ON public.monthly_checks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- monthly_check_evidence
-- ============================================================
CREATE TABLE public.monthly_check_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_check_id uuid NOT NULL REFERENCES public.monthly_checks(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  source text,
  summary text,
  raw_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.monthly_check_evidence TO authenticated;
GRANT ALL ON public.monthly_check_evidence TO service_role;
ALTER TABLE public.monthly_check_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage evidence" ON public.monthly_check_evidence
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- blast_analyses
-- ============================================================
CREATE TABLE public.blast_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date_start date NOT NULL,
  date_end date NOT NULL,
  reply_tag text NOT NULL,
  workflow_name_or_id text,
  message_phrase text NOT NULL,
  total_replied_contacts integer NOT NULL DEFAULT 0,
  positive_count integer NOT NULL DEFAULT 0,
  negative_count integer NOT NULL DEFAULT 0,
  neutral_count integer NOT NULL DEFAULT 0,
  opt_out_count integer NOT NULL DEFAULT 0,
  needs_review_count integer NOT NULL DEFAULT 0,
  summary text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.blast_analyses TO authenticated;
GRANT ALL ON public.blast_analyses TO service_role;
ALTER TABLE public.blast_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage blast analyses" ON public.blast_analyses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- blast_reply_classifications
-- ============================================================
CREATE TABLE public.blast_reply_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blast_analysis_id uuid NOT NULL REFERENCES public.blast_analyses(id) ON DELETE CASCADE,
  contact_id text,
  contact_name text,
  conversation_id text,
  classification text NOT NULL,
  summary text,
  evidence_message_ids text,
  confidence real,
  analysis_method text,
  review_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.blast_reply_classifications TO authenticated;
GRANT ALL ON public.blast_reply_classifications TO service_role;
ALTER TABLE public.blast_reply_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage classifications" ON public.blast_reply_classifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- api_audit_logs (admin-only read)
-- ============================================================
CREATE TABLE public.api_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  status text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.api_audit_logs TO authenticated;
GRANT ALL ON public.api_audit_logs TO service_role;
ALTER TABLE public.api_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit logs" ON public.api_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "authenticated insert audit logs" ON public.api_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_routing_updated BEFORE UPDATE ON public.routing_setups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_monthly_checks_updated BEFORE UPDATE ON public.monthly_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_blast_analyses_updated BEFORE UPDATE ON public.blast_analyses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_app_users_updated BEFORE UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();