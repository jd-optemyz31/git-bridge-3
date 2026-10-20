-- ============================================================
-- blast_jobs: progress + result persistence for the Blast Analyzer
-- ============================================================
CREATE TABLE public.blast_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  phase text,
  phase_label text,
  percent integer NOT NULL DEFAULT 0,
  detail text,
  reply_tag text,
  message_phrase text,
  date_start date,
  date_end date,
  error text,
  blast_analysis_id uuid REFERENCES public.blast_analyses(id) ON DELETE SET NULL,
  progress jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.blast_jobs TO authenticated;
GRANT ALL ON public.blast_jobs TO service_role;
ALTER TABLE public.blast_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own blast jobs" ON public.blast_jobs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_blast_jobs_updated BEFORE UPDATE ON public.blast_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();