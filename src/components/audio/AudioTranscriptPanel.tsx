/**
 * F-AUDIO-1 + F-AUDIO-2: Audio Transcript Panel.
 *
 * Lets users upload meeting recordings, tracks transcription status,
 * shows diarized transcript chunks, and extracts action items from done
 * transcripts. Gated on ASSEMBLYAI_API_KEY — shows a "not yet active"
 * state when the key is absent rather than hiding the feature.
 */
import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mic, Upload, CheckCircle, AlertCircle, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  submitAudioForTranscription,
  pollTranscriptionStatus,
  listTranscripts,
  extractActionsFromTranscript,
  type AudioTranscript,
  type TranscriptChunk,
} from "@/lib/audio.functions";

const ACCEPTED_MIME = [
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm",
  "audio/ogg", "audio/flac", "audio/m4a", "video/mp4", "video/webm",
].join(",");

const SPEAKER_COLORS: Record<string, string> = {
  A: "text-blue-600",
  B: "text-emerald-600",
  C: "text-violet-600",
  D: "text-orange-600",
};
const speakerColor = (s: string) => SPEAKER_COLORS[s] ?? "text-slate-600";

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: AudioTranscript["status"] }) {
  if (status === "processing")
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing</Badge>;
  if (status === "done")
    return <Badge variant="default" className="gap-1 bg-emerald-600"><CheckCircle className="h-3 w-3" />Done</Badge>;
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Error</Badge>;
}

function ChunkView({ chunks }: { chunks: TranscriptChunk[] }) {
  return (
    <div className="space-y-2 text-sm">
      {chunks.map((c, i) => (
        <div key={i} className="flex gap-3">
          <span className={`font-mono font-semibold w-12 shrink-0 ${speakerColor(c.speaker)}`}>
            {c.speaker}
          </span>
          <span className="text-slate-400 font-mono text-xs shrink-0 pt-0.5 w-14">
            {formatMs(c.start_ms)}
          </span>
          <p className="text-slate-700 leading-relaxed">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

function TranscriptCard({
  transcript,
  onExtract,
}: {
  transcript: AudioTranscript;
  onExtract: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border border-slate-200">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Mic className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="font-medium text-sm truncate">{transcript.file_name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={transcript.status} />
            {transcript.status === "done" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
                className="h-7 gap-1 text-xs"
              >
                Transcript
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
          </div>
        </div>
        {transcript.duration_seconds && (
          <p className="text-xs text-slate-400 ml-6">
            {Math.round(transcript.duration_seconds / 60)} min recording
          </p>
        )}
      </CardHeader>

      {transcript.status === "done" && (
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          {expanded && transcript.chunks.length > 0 && (
            <>
              <Separator />
              <ChunkView chunks={transcript.chunks} />
            </>
          )}

          {expanded && transcript.chunks.length === 0 && transcript.transcript_text && (
            <>
              <Separator />
              <p className="text-sm text-slate-700 leading-relaxed">{transcript.transcript_text}</p>
            </>
          )}

          {transcript.action_items.length > 0 ? (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Action items
                </p>
                <ul className="space-y-1.5">
                  {transcript.action_items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-emerald-500 mt-0.5">+</span>
                      <div>
                        <span className="font-medium">{item.title}</span>
                        {item.owner && (
                          <span className="text-slate-400 ml-1">— {item.owner}</span>
                        )}
                        {item.due_date && (
                          <span className="text-slate-400 ml-1">by {item.due_date}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExtract(transcript.id)}
              className="gap-1.5 text-xs h-7"
            >
              <Sparkles className="h-3 w-3" />
              Extract action items
            </Button>
          )}
        </CardContent>
      )}

      {transcript.status === "error" && transcript.error_message && (
        <CardContent className="pt-0 px-4 pb-4">
          <p className="text-sm text-red-600">{transcript.error_message}</p>
        </CardContent>
      )}
    </Card>
  );
}

export function AudioTranscriptPanel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const { data: transcripts = [], isLoading } = useQuery({
    queryKey: ["audio-transcripts"],
    queryFn: () => listTranscripts({}),
    refetchInterval: (data) => {
      const hasProcessing = (data.state.data ?? []).some((t) => t.status === "processing");
      return hasProcessing ? 4000 : false;
    },
  });

  const pollMutation = useMutation({
    mutationFn: ({ transcriptId }: { transcriptId: string }) =>
      pollTranscriptionStatus({ data: { transcriptId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-transcripts"] }),
  });

  const extractMutation = useMutation({
    mutationFn: (transcriptId: string) =>
      extractActionsFromTranscript({ data: { transcriptId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-transcripts"] }),
  });

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setGateError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop() ?? "mp3";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("audio-transcripts")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (upErr) throw upErr;

      await submitAudioForTranscription({
        data: { storagePath: path, fileName: file.name },
      });

      qc.invalidateQueries({ queryKey: ["audio-transcripts"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ASSEMBLYAI_API_KEY")) {
        setGateError("Audio transcription is not yet active. The founder needs to set ASSEMBLYAI_API_KEY.");
      } else {
        setGateError(msg);
      }
    } finally {
      setUploading(false);
    }
  }, [qc]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Meeting transcripts</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload a recording to get a diarized transcript and extracted action items.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="gap-1.5 text-xs"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload recording"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {gateError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {gateError}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transcripts...
        </div>
      )}

      {!isLoading && transcripts.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-8 text-center">
          <Mic className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No transcripts yet</p>
          <p className="text-xs text-slate-300 mt-1">Upload a meeting recording to get started</p>
        </div>
      )}

      <div className="space-y-2">
        {transcripts.map((t) => (
          <TranscriptCard
            key={t.id}
            transcript={t}
            onExtract={(id) => extractMutation.mutate(id)}
          />
        ))}
      </div>

      {/* Poll processing transcripts */}
      {transcripts.some((t) => t.status === "processing") && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Transcription in progress — checking status automatically...
          <button
            onClick={() => {
              transcripts
                .filter((t) => t.status === "processing")
                .forEach((t) => pollMutation.mutate({ transcriptId: t.id }));
            }}
            className="underline hover:text-slate-600"
          >
            Refresh now
          </button>
        </div>
      )}
    </div>
  );
}
