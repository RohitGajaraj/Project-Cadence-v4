
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prd_id uuid REFERENCES public.prds(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  entry_path text NOT NULL DEFAULT 'index.html',
  share_slug text UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 10),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.prototype_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'html',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prototype_id, path)
);

CREATE INDEX idx_prototype_files_proto ON public.prototype_files(prototype_id);
CREATE INDEX idx_prototypes_user ON public.prototypes(user_id);
CREATE INDEX idx_prototypes_slug ON public.prototypes(share_slug);

ALTER TABLE public.prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prototype_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prototypes all" ON public.prototypes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public prototypes readable" ON public.prototypes
  FOR SELECT USING (is_public = true);
CREATE POLICY "own prototype_files all" ON public.prototype_files
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public prototype_files readable" ON public.prototype_files
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.prototypes p WHERE p.id = prototype_id AND p.is_public = true
  ));

CREATE TRIGGER trg_prototypes_updated BEFORE UPDATE ON public.prototypes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prototype_files_updated BEFORE UPDATE ON public.prototype_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
