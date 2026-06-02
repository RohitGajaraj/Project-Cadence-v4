
CREATE TABLE public.prototype_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message_id uuid,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  storage_path text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prototype_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments all" ON public.prototype_attachments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-attachments', 'studio-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "studio attachments owner read" ON storage.objects
  FOR SELECT USING (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "studio attachments owner insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "studio attachments owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
