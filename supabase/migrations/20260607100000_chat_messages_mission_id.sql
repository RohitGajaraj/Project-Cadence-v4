-- Add mission_id foreign key column to the messages table
ALTER TABLE public.messages ADD COLUMN mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL;

-- Create index for faster queries linking messages to missions
CREATE INDEX IF NOT EXISTS idx_messages_mission_id ON public.messages(mission_id);
