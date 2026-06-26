-- F-AUDIO-1 + F-AUDIO-2: Speech transcription + action-item extraction
--
-- audio_transcripts: one row per meeting/call uploaded for transcription.
-- Chunks (speaker-diarized utterances) stored as jsonb so the schema
-- stays simple and the frontend can render a full diarized transcript.
-- action_items stores F-AUDIO-2 output: AI-extracted draft opportunities
-- citing the transcript as the source.
--
-- ACTIVATION GATE: the submit/poll functions gate on ASSEMBLYAI_API_KEY.
-- Apply this migration; then set the key to make uploads work end-to-end.
-- Without the key, uploads are blocked at the server function layer with a
-- clear 'ASSEMBLYAI_API_KEY not set' message.

CREATE TABLE IF NOT EXISTS public.audio_transcripts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'done', 'error')),
  transcript_text text,
  -- [{speaker: "A"|"B"|..., text: string, start_ms: number, end_ms: number}]
  chunks jsonb NOT NULL DEFAULT '[]',
  assemblyai_id text,
  error_message text,
  -- F-AUDIO-2: extracted action items [{title, owner?, due_date?, raw_text}]
  action_items jsonb NOT NULL DEFAULT '[]',
  actions_extracted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.audio_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own audio transcripts"
  ON public.audio_transcripts
  FOR ALL
  USING (auth.uid() = user_id);

-- Workspace members can read transcripts in their workspace
CREATE POLICY "Workspace members read audio transcripts"
  ON public.audio_transcripts
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_audio_transcripts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER audio_transcripts_updated_at
  BEFORE UPDATE ON public.audio_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.touch_audio_transcripts_updated_at();

-- Index for workspace transcript lists (most recent first)
CREATE INDEX IF NOT EXISTS audio_transcripts_workspace_created
  ON public.audio_transcripts (workspace_id, created_at DESC);

-- Index for polling: find processing transcripts with an assemblyai_id
CREATE INDEX IF NOT EXISTS audio_transcripts_processing
  ON public.audio_transcripts (assemblyai_id)
  WHERE status = 'processing' AND assemblyai_id IS NOT NULL;

-- Storage bucket for audio files (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-transcripts',
  'audio-transcripts',
  false,
  104857600,  -- 100 MB
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
        'audio/flac', 'audio/m4a', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: users can upload/read their own files
CREATE POLICY "Users upload own audio files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-transcripts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own audio files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-transcripts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own audio files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-transcripts' AND auth.uid()::text = (storage.foldername(name))[1]);
