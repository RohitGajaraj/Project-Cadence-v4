/**
 * F-AUDIO-1 + F-AUDIO-2: Speech transcription + action-item extraction.
 *
 * ACTIVATION GATE: set ASSEMBLYAI_API_KEY to enable. Without the key,
 * submitAudioForTranscription returns a clear gated error. The table and
 * UI are always present — only the external API calls are gated.
 *
 * Flow (F-AUDIO-1):
 *   1. Client uploads file to Supabase Storage bucket 'audio-transcripts'
 *      at path `{userId}/{uuid}.{ext}`.
 *   2. Client calls submitAudioForTranscription with the storage path.
 *   3. Server fn signs the storage URL, submits to AssemblyAI, stores the
 *      transcript row with status='processing' + assemblyai_id.
 *   4. Client polls pollTranscriptionStatus until status = 'done' | 'error'.
 *
 * Flow (F-AUDIO-2):
 *   5. Once done, client calls extractActionsFromTranscript.
 *   6. Server fn calls the AI (via callModel 'agent') to extract action items
 *      from the transcript, stores them in audio_transcripts.action_items,
 *      and inserts a source='transcript_action' signal per action for the
 *      ambient engine to surface.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callModel } from "@/lib/ai/runtime.server";

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

// audio_transcripts is a new table added by migration 20260626220000_audio_transcripts.sql.
// The generated Supabase types don't include it until the migration is applied and types
// are regenerated. Cast via this helper so all callers stay type-safe in the rest of their
// logic while bypassing the Supabase type registry for this specific table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const audioDb = supabaseAdmin as any;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TranscriptChunk = {
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
};

export type ActionItem = {
  title: string;
  owner?: string;
  due_date?: string;
  raw_text: string;
};

export type AudioTranscript = {
  id: string;
  user_id: string;
  workspace_id: string;
  file_name: string;
  file_url: string;
  duration_seconds: number | null;
  status: "processing" | "done" | "error";
  transcript_text: string | null;
  chunks: TranscriptChunk[];
  action_items: ActionItem[];
  actions_extracted_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveWorkspaceId(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  explicit: string | null | undefined,
): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabase.rpc("current_user_default_workspace");
  return (data as string | null) ?? null;
}

function assertApiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new Error(
      "ASSEMBLYAI_API_KEY not set — audio transcription is dormant by design. " +
        "Set the key in wrangler secrets to activate.",
    );
  }
  return key;
}

// ---------------------------------------------------------------------------
// F-AUDIO-1: submit + poll
// ---------------------------------------------------------------------------

export const submitAudioForTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid().nullable().optional(),
        storagePath: z.string().min(1),
        fileName: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<{ transcriptId: string }> => {
    const apiKey = assertApiKey();
    const { supabase } = context;
    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) throw new Error("No workspace found");

    const userId = context.auth.user.id;

    // Ownership guard: storagePath must be under the user's own folder.
    // The service role bypasses RLS when signing URLs, so we enforce this
    // server-side before handing the signed URL to AssemblyAI.
    // Reject '..' components to prevent path traversal (e.g. userId/../../other/file).
    if (!data.storagePath.startsWith(`${userId}/`) || data.storagePath.includes("..")) {
      throw new Error("Forbidden: invalid storagePath");
    }

    // Sign the storage URL so AssemblyAI can fetch the file
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("audio-transcripts")
      .createSignedUrl(data.storagePath, 3600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Could not sign storage URL: ${signErr?.message}`);
    }

    // Submit to AssemblyAI
    const resp = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: signed.signedUrl,
        speaker_labels: true,
        language_detection: true,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`AssemblyAI submission failed (${resp.status}): ${body.slice(0, 200)}`);
    }

    const result = (await resp.json()) as { id: string };

    // Store transcript record
    const { data: row, error: insertErr } = await audioDb
      .from("audio_transcripts")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        file_name: data.fileName,
        file_url: data.storagePath,
        status: "processing",
        assemblyai_id: result.id,
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(insertErr.message);
    return { transcriptId: row!.id };
  });

export const pollTranscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transcriptId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<AudioTranscript> => {
    const apiKey = assertApiKey();
    const userId = context.auth.user.id;

    // Fetch our record
    const { data: row, error } = await audioDb
      .from("audio_transcripts")
      .select("*")
      .eq("id", data.transcriptId)
      .eq("user_id", userId)
      .single();

    if (error || !row) throw new Error("Transcript not found");

    const transcript = row as unknown as AudioTranscript & { assemblyai_id: string | null };

    // Already terminal — return as-is
    if (transcript.status !== "processing") return transcript;

    // Poll AssemblyAI
    const resp = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcript.assemblyai_id}`, {
      headers: { Authorization: apiKey },
    });

    if (!resp.ok) return transcript; // transient error — caller retries

    const aaResult = (await resp.json()) as {
      status: string;
      text?: string;
      duration?: number;
      error?: string;
      utterances?: Array<{
        speaker: string;
        text: string;
        start: number;
        end: number;
      }>;
    };

    if (aaResult.status === "completed") {
      const chunks: TranscriptChunk[] = (aaResult.utterances ?? []).map((u) => ({
        speaker: u.speaker,
        text: u.text,
        start_ms: u.start,
        end_ms: u.end,
      }));

      await audioDb
        .from("audio_transcripts")
        .update({
          status: "done",
          transcript_text: aaResult.text ?? "",
          chunks,
          duration_seconds: aaResult.duration ? Math.round(aaResult.duration) : null,
        })
        .eq("id", data.transcriptId);

      return { ...transcript, status: "done", transcript_text: aaResult.text ?? "", chunks };
    } else if (aaResult.status === "error") {
      await audioDb
        .from("audio_transcripts")
        .update({ status: "error", error_message: aaResult.error ?? "Unknown error" })
        .eq("id", data.transcriptId);

      return { ...transcript, status: "error", error_message: aaResult.error ?? null };
    }

    // Still processing
    return transcript;
  });

export const listTranscripts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId?: string | null } | undefined) =>
    z.object({ workspaceId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<AudioTranscript[]> => {
    const { supabase } = context;
    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (supabase as any)
      .from("audio_transcripts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);

    return (rows ?? []) as unknown as AudioTranscript[];
  });

// ---------------------------------------------------------------------------
// F-AUDIO-2: action-item extraction
// ---------------------------------------------------------------------------

const ACTION_ITEM_SCHEMA = z.object({
  action_items: z.array(
    z.object({
      title: z.string(),
      owner: z.string().optional(),
      due_date: z.string().optional(),
      raw_text: z.string(),
    }),
  ),
});

export const extractActionsFromTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transcriptId: z.string().uuid() }).parse(d))
  .handler(
    async ({ context, data }): Promise<{ actionItems: ActionItem[]; signalsInserted: number }> => {
      const userId = context.auth.user.id;

      const { data: row, error } = await audioDb
        .from("audio_transcripts")
        .select("*")
        .eq("id", data.transcriptId)
        .eq("user_id", userId)
        .single();

      if (error || !row) throw new Error("Transcript not found");
      const transcript = row as unknown as AudioTranscript & { workspace_id: string };

      if (transcript.status !== "done") {
        throw new Error("Transcript is not yet complete");
      }
      if (!transcript.transcript_text?.trim()) {
        throw new Error("Transcript text is empty");
      }

      const system = `You are an executive assistant. Extract every concrete action item from the meeting transcript below.
Return JSON with key "action_items" — an array of objects with: title (brief action description), owner (person responsible, if named), due_date (if mentioned, ISO format), raw_text (the verbatim excerpt that surfaced this action).
Only include real commitments, not vague discussion points.`;

      const userMsg = `Meeting transcript:\n\n${transcript.transcript_text.slice(0, 8000)}`;

      const res = await callModel(supabaseAdmin as never, userId, {
        surface: "agent",
        surface_ref: `audio:actions:${data.transcriptId}`,
        model: "google/gemini-2.5-flash",
        fallbackModel: "anthropic/claude-haiku-4-5-20251001",
        responseFormat: "json_object",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      });

      let actionItems: ActionItem[] = [];
      try {
        const parsed = ACTION_ITEM_SCHEMA.parse(res.json);
        actionItems = parsed.action_items;
      } catch {
        // Fallback: try to parse res.output as JSON
        try {
          const parsed = ACTION_ITEM_SCHEMA.parse(JSON.parse(res.output));
          actionItems = parsed.action_items;
        } catch {
          actionItems = [];
        }
      }

      // Store action items on the transcript row
      await audioDb
        .from("audio_transcripts")
        .update({
          action_items: actionItems,
          actions_extracted_at: new Date().toISOString(),
        })
        .eq("id", data.transcriptId);

      // Insert a signal per action item so the ambient engine surfaces them
      let signalsInserted = 0;
      for (const item of actionItems.slice(0, 10)) {
        const { error: sigErr } = await supabaseAdmin.from("signals").insert({
          user_id: userId,
          workspace_id: transcript.workspace_id,
          source: "transcript_action",
          title: item.title.slice(0, 200),
          content:
            `From meeting transcript "${transcript.file_name}"` +
            (item.owner ? ` — owner: ${item.owner}` : "") +
            (item.due_date ? ` — due: ${item.due_date}` : "") +
            `\n\n"${item.raw_text}"`,
        });
        if (!sigErr) signalsInserted++;
      }

      return { actionItems, signalsInserted };
    },
  );
