import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Code as CodeIcon,
  Link2,
  Undo2,
  Redo2,
  Figma,
} from "lucide-react";
import { FigmaEmbed } from "./editor/FigmaEmbed";
import { usePrompt } from "@/hooks/use-confirm";

export function DocEditor({
  initialContent,
  onChange,
  placeholder = "Type '/' for commands… or just start writing.",
}: {
  initialContent: unknown;
  onChange: (json: unknown) => void;
  placeholder?: string;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slash, setSlash] = useState<{ x: number; y: number } | null>(null);
  const prompt = usePrompt();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Placeholder.configure({ placeholder }),
      FigmaEmbed,
    ],
    content: (initialContent as object) ?? { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class:
          "prose max-w-none focus:outline-none min-h-[60vh] px-2 py-4 prose-headings:font-display prose-headings:tracking-tight prose-p:leading-relaxed prose-code:text-violet-300 prose-code:bg-secondary/60 prose-code:px-1 prose-code:rounded",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "/") {
          setTimeout(() => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            setSlash({ x: rect.left, y: rect.bottom + 4 });
          }, 0);
        } else if (event.key === "Escape") {
          setSlash(null);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(editor.getJSON()), 600);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor) return null;

  const Btn = ({
    on,
    active,
    children,
    title,
  }: {
    on: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      title={title}
      onClick={on}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-md text-xs transition ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
    >
      {children}
    </button>
  );

  function deleteSlashChar() {
    // Remove the "/" the user just typed before inserting the block.
    editor
      ?.chain()
      .focus()
      .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from })
      .run();
  }

  const slashItems = [
    {
      label: "Heading 1",
      icon: <Heading1 className="h-4 w-4" />,
      run: () => {
        deleteSlashChar();
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      },
    },
    {
      label: "Heading 2",
      icon: <Heading2 className="h-4 w-4" />,
      run: () => {
        deleteSlashChar();
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
    },
    {
      label: "Bullet list",
      icon: <List className="h-4 w-4" />,
      run: () => {
        deleteSlashChar();
        editor.chain().focus().toggleBulletList().run();
      },
    },
    {
      label: "Numbered list",
      icon: <ListOrdered className="h-4 w-4" />,
      run: () => {
        deleteSlashChar();
        editor.chain().focus().toggleOrderedList().run();
      },
    },
    {
      label: "Quote",
      icon: <Quote className="h-4 w-4" />,
      run: () => {
        deleteSlashChar();
        editor.chain().focus().toggleBlockquote().run();
      },
    },
    {
      label: "Code block",
      icon: <CodeIcon className="h-4 w-4" />,
      run: () => {
        deleteSlashChar();
        editor.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      label: "Figma embed",
      icon: <Figma className="h-4 w-4" />,
      run: () => {
        void (async () => {
          const url = await prompt({
            title: "Embed Figma",
            label: "Figma file or prototype URL",
            placeholder: "https://www.figma.com/file/…",
            confirmLabel: "Embed",
          });
          if (!url) return;
          deleteSlashChar();
          (
            editor.chain().focus() as unknown as {
              setFigmaEmbed: (a: { src: string }) => { run: () => void };
            }
          )
            .setFigmaEmbed({ src: url })
            .run();
        })();
      },
    },
  ];

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 flex items-center gap-0.5 border-b hairline bg-background/80 backdrop-blur-md px-1 py-1">
        <Btn
          title="Heading 1"
          on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
        >
          <Heading1 className="h-4 w-4" />
        </Btn>
        <Btn
          title="Heading 2"
          on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
        >
          <Heading2 className="h-4 w-4" />
        </Btn>
        <div className="w-px h-5 bg-border/60 mx-1" />
        <Btn
          title="Bold"
          on={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
        >
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn
          title="Italic"
          on={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
        >
          <Italic className="h-4 w-4" />
        </Btn>
        <Btn
          title="Underline"
          on={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Btn>
        <div className="w-px h-5 bg-border/60 mx-1" />
        <Btn
          title="Bullet list"
          on={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
        >
          <List className="h-4 w-4" />
        </Btn>
        <Btn
          title="Numbered list"
          on={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn
          title="Quote"
          on={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
        >
          <Quote className="h-4 w-4" />
        </Btn>
        <Btn
          title="Code block"
          on={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
        >
          <CodeIcon className="h-4 w-4" />
        </Btn>
        <Btn
          title="Link"
          on={() => {
            void (async () => {
              const url = await prompt({
                title: "Add link",
                label: "URL",
                placeholder: "https://…",
                confirmLabel: "Add",
              });
              if (url) editor.chain().focus().setLink({ href: url }).run();
            })();
          }}
          active={editor.isActive("link")}
        >
          <Link2 className="h-4 w-4" />
        </Btn>
        <Btn
          title="Figma embed"
          on={() => {
            void (async () => {
              const url = await prompt({
                title: "Embed Figma",
                label: "Figma file or prototype URL",
                placeholder: "https://www.figma.com/file/…",
                confirmLabel: "Embed",
              });
              if (url)
                (
                  editor.chain().focus() as unknown as {
                    setFigmaEmbed: (a: { src: string }) => { run: () => void };
                  }
                )
                  .setFigmaEmbed({ src: url })
                  .run();
            })();
          }}
        >
          <Figma className="h-4 w-4" />
        </Btn>
        <div className="flex-1" />
        <Btn title="Undo" on={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </Btn>
        <Btn title="Redo" on={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </Btn>
      </div>
      <EditorContent editor={editor} />
      {slash && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSlash(null)} />
          <div
            className="fixed z-30 w-56 rounded-lg border hairline bg-background/95 backdrop-blur-xl shadow-xl p-1"
            style={{ left: slash.x, top: slash.y }}
          >
            <div className="px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Insert
            </div>
            {slashItems.map((it) => (
              <button
                key={it.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  it.run();
                  setSlash(null);
                }}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                {it.icon}
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
