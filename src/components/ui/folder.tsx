import { ClientOnly } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";

const PAGES = [
  {
    closed: { rotate: -3.5, x: -38, y: 4 },
    open: { rotate: -14, x: -84, y: -78 },
    transition: {
      type: "spring" as const,
      duration: 0.58,
      bounce: 0.15,
      stiffness: 155,
      damping: 20,
    },
    zIndex: 4,
  },
  {
    closed: { rotate: 0, x: 0, y: 0 },
    open: { rotate: 2, x: 2, y: -90 },
    transition: {
      type: "spring" as const,
      duration: 0.53,
      bounce: 0.12,
      stiffness: 185,
      damping: 23,
    },
    zIndex: 5,
  },
  {
    closed: { rotate: 4, x: 42, y: 3 },
    open: { rotate: 14, x: 84, y: -78 },
    transition: {
      type: "spring" as const,
      duration: 0.56,
      bounce: 0.17,
      stiffness: 165,
      damping: 20,
    },
    zIndex: 4,
  },
];

const Page = () => (
  <div className="w-[200px] h-[230px] rounded-lg bg-canvas shadow-[0_4px_18px_-6px_rgba(0,0,0,0.35)] border border-ink/10 p-4 flex flex-col gap-2">
    <div className="h-2 w-2/3 rounded-full bg-neutral-200" />
    {Array.from({ length: 7 }).map((_, i) => (
      <div
        key={i}
        className="h-1.5 rounded-full bg-neutral-100"
        style={{ width: `${60 + ((i * 37) % 40)}%` }}
      />
    ))}
  </div>
);

const FolderBack = () => (
  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
);

const FolderFront = () => (
  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_-8px_rgba(0,0,0,0.45)]">
    <div className="absolute top-0 left-4 h-3 w-16 rounded-t-md bg-amber-400 -translate-y-2" />
    <div className="absolute inset-x-0 top-0 h-px bg-white/40 rounded-t-2xl" />
  </div>
);

function FolderInteractionInner({ label = "Delete with Autopilot" }: { label?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative flex flex-col items-center justify-center py-10">
      {/* Tooltip */}
      <motion.div
        initial={false}
        animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 6 }}
        transition={{ duration: 0.2 }}
        className="mb-4 relative"
      >
        <div className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium shadow-md">
          {label}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-foreground" />
      </motion.div>

      <div onClick={() => setIsOpen((v) => !v)} className="w-[280px] h-60 relative cursor-pointer">
        {/* Aura */}
        <div className="absolute -inset-6 rounded-full bg-black/20 blur-2xl" />

        {/* Folder back */}
        <FolderBack />

        {/* Pages */}
        {PAGES.map((p, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={isOpen ? p.open : p.closed}
            transition={p.transition}
            style={{ zIndex: p.zIndex }}
            className="absolute left-1/2 top-4 -translate-x-1/2"
          >
            <Page />
          </motion.div>
        ))}

        {/* Front flap */}
        <div className="absolute inset-x-0 bottom-0 h-[62%]" style={{ zIndex: 6 }}>
          <FolderFront />
        </div>
      </div>
    </div>
  );
}

export default function FolderInteraction(props: { label?: string }) {
  return (
    <ClientOnly fallback={<div className="w-[280px] h-60" />}>
      <FolderInteractionInner {...props} />
    </ClientOnly>
  );
}
