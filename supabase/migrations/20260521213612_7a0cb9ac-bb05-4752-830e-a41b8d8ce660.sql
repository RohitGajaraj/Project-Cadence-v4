
CREATE TABLE IF NOT EXISTS public.prototype_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  changes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prototype_messages_proto ON public.prototype_messages(prototype_id, created_at);

ALTER TABLE public.prototype_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prototype_messages all"
ON public.prototype_messages
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
