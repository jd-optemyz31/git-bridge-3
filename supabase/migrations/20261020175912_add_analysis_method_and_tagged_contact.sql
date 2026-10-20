ALTER TABLE public.blast_analyses
  ADD COLUMN IF NOT EXISTS analysis_method text,
  ADD COLUMN IF NOT EXISTS tagged_contact_count integer NOT NULL DEFAULT 0;