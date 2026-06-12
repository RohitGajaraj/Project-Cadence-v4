import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/p/$slug")({ component: PublicPrototype });

type FileRow = { path: string; content: string; language: string };

function buildSrcDoc(files: FileRow[], entry: string): string {
  const html = files.find((f) => f.path === entry) ?? files.find((f) => f.path.endsWith(".html"));
  if (!html) return "<html><body><p>No HTML file</p></body></html>";
  let out = html.content;
  out = out.replace(/<link[^>]*href=["']([^"']+\.css)["'][^>]*>/g, (_m, href) => {
    const css = files.find((f) => f.path === href);
    return css ? `<style>${css.content}</style>` : _m;
  });
  out = out.replace(/<script[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/g, (_m, src) => {
    const js = files.find((f) => f.path === src);
    return js ? `<script>\n${js.content}\n</script>` : _m;
  });
  return out;
}

function PublicPrototype() {
  const { slug } = Route.useParams();
  const [state, setState] = useState<{ name: string; src: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: proto, error } = await supabase
        .from("prototypes")
        .select("id,name,entry_path,is_public")
        .eq("share_slug", slug)
        .maybeSingle();
      if (error || !proto || !proto.is_public) {
        setErr("This prototype is private or not found.");
        return;
      }
      const { data: files, error: e2 } = await supabase
        .from("prototype_files")
        .select("path,content,language")
        .eq("prototype_id", proto.id);
      if (e2) {
        setErr(e2.message);
        return;
      }
      setState({ name: proto.name, src: buildSrcDoc(files ?? [], proto.entry_path) });
    })();
  }, [slug]);

  if (err)
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
        <div>
          <div className="font-display text-xl">Unavailable</div>
          <p className="text-sm text-muted-foreground mt-2">{err}</p>
        </div>
      </div>
    );
  if (!state)
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        Loading prototype…
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b hairline px-4 py-2.5 flex items-center justify-between bg-background/60 backdrop-blur">
        <div className="font-display text-sm">{state.name}</div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Made with Cadence
        </div>
      </header>
      <iframe
        title={state.name}
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={state.src}
        className="flex-1 w-full bg-canvas"
      />
    </div>
  );
}
