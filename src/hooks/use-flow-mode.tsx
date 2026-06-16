import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast, setFlowActive, drainHeldNotifications, heldCount } from "@/lib/notify";
import { playChime } from "@/lib/flow/chime";
import * as soundscape from "@/lib/flow/soundscape";
import {
  endsAtFor,
  formatRemaining,
  isResumable,
  remainingMs,
  type FlowSession,
  type SoundPreset,
} from "@/lib/flow/session";

// Flow mode: a calm operating stance. While on, the chrome dims, an ambient
// soundscape plays, a focus timer runs, and non-urgent toasts are held and
// summarized on exit. State mirrors use-theme.tsx (context + localStorage + a
// documentElement class); the audio + toast machinery lives in lib/flow/* and
// lib/notify.ts (Engine-Room: hidden behind this one control).

export type FlowConfig = {
  preset: SoundPreset;
  volume: number; // 0..1
  timerMin: number; // 0 = open-ended
};

type FlowContextValue = {
  isFlowMode: boolean;
  remainingMs: number | null;
  remainingLabel: string;
  heldCount: number;
  soundResumable: boolean; // true after a reload-resume, until the next gesture
  soundUnavailable: boolean; // the chosen track has no file yet (see README)
  config: FlowConfig;
  setConfig: (patch: Partial<FlowConfig>) => void;
  enterFlow: (patch?: Partial<FlowConfig>) => void;
  exitFlow: () => void;
  resumeSound: () => void;
};

const CONFIG_KEY = "cadence.flow.config";
const SESSION_KEY = "cadence.flow.session";

const DEFAULT_CONFIG: FlowConfig = { preset: "rain", volume: 0.5, timerMin: 25 };

const FlowContext = createContext<FlowContextValue | null>(null);

function applyFlowClass(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("flow", active);
}

function readConfig(): FlowConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<FlowConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function writeConfig(config: FlowConfig) {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* noop */
  }
}

function readSession(): FlowSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as FlowSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: FlowSession | null) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

export function FlowModeProvider({ children }: { children: ReactNode }) {
  const [isFlowMode, setIsFlowMode] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [held, setHeld] = useState(0);
  const [soundResumable, setSoundResumable] = useState(false);
  const [soundUnavailable, setSoundUnavailable] = useState(false);
  const [config, setConfigState] = useState<FlowConfig>(DEFAULT_CONFIG);

  // Latest values for the interval + completion path without resubscribing.
  const configRef = useRef(config);
  configRef.current = config;
  const exitRef = useRef<(reason: "manual" | "completed") => void>(() => {});

  // Hydrate config + resume an in-flight session after a reload.
  useEffect(() => {
    setConfigState(readConfig());
    const session = readSession();
    const now = Date.now();
    if (isResumable(session, now) && session) {
      setIsFlowMode(true);
      applyFlowClass(true);
      setFlowActive(true);
      setEndsAt(session.endsAt);
      setRemaining(remainingMs(session.endsAt, now));
      // Audio can't auto-start without a gesture; offer a resume tap instead.
      setSoundResumable(session.preset !== "off");
    } else if (session) {
      writeSession(null);
    }
  }, []);

  const exitFlow = useCallback((reason: "manual" | "completed" = "manual") => {
    soundscape.stop();
    applyFlowClass(false);
    setFlowActive(false);
    setIsFlowMode(false);
    setEndsAt(null);
    setRemaining(null);
    setSoundResumable(false);
    writeSession(null);

    const { count } = drainHeldNotifications();
    if (reason === "completed") {
      const tail = count > 0 ? ` ${count} update${plural(count)} while you were focused.` : "";
      toast.success(`Focus block done.${tail}`);
    } else if (count > 0) {
      toast(`While you were focused · ${count} update${plural(count)}`);
    }
  }, []);
  exitRef.current = exitFlow;

  const enterFlow = useCallback((patch?: Partial<FlowConfig>) => {
    const next = { ...configRef.current, ...patch };
    if (patch) {
      setConfigState(next);
      writeConfig(next);
    }
    const now = Date.now();
    const deadline = endsAtFor(next.timerMin, now);

    setIsFlowMode(true);
    applyFlowClass(true);
    setFlowActive(true);
    setEndsAt(deadline);
    setRemaining(remainingMs(deadline, now));
    setSoundResumable(false);
    setSoundUnavailable(false);
    writeSession({ endsAt: deadline, preset: next.preset, soundOn: next.preset !== "off" });

    if (next.preset !== "off") {
      void soundscape.start(next.preset, next.volume).then((ok) => {
        if (!ok) setSoundUnavailable(true);
      });
    }
  }, []);

  const setConfig = useCallback(
    (patch: Partial<FlowConfig>) => {
      const next = { ...configRef.current, ...patch };
      setConfigState(next);
      writeConfig(next);
      if (!isFlowMode) return;
      if (patch.preset !== undefined) {
        setSoundUnavailable(false);
        if (next.preset === "off") {
          soundscape.stop();
        } else {
          void soundscape.setPreset(next.preset, next.volume).then((ok) => {
            if (!ok) setSoundUnavailable(true);
          });
        }
      } else if (patch.volume !== undefined) {
        soundscape.setVolume(next.volume);
      }
    },
    [isFlowMode],
  );

  const resumeSound = useCallback(() => {
    setSoundUnavailable(false);
    void soundscape.start(configRef.current.preset, configRef.current.volume).then((ok) => {
      if (!ok && configRef.current.preset !== "off") setSoundUnavailable(true);
    });
    setSoundResumable(false);
  }, []);

  // One light tick while flow is on: refresh the countdown + held-toast count,
  // and finish the session when the timer reaches zero.
  useEffect(() => {
    if (!isFlowMode) return;
    const id = window.setInterval(() => {
      setHeld(heldCount());
      if (endsAt !== null) {
        const left = remainingMs(endsAt, Date.now());
        setRemaining(left);
        if (left !== null && left <= 0) {
          playChime();
          exitRef.current("completed");
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isFlowMode, endsAt]);

  const value: FlowContextValue = {
    isFlowMode,
    remainingMs: remaining,
    remainingLabel: formatRemaining(remaining),
    heldCount: held,
    soundResumable,
    soundUnavailable,
    config,
    setConfig,
    enterFlow,
    exitFlow: () => exitFlow("manual"),
    resumeSound,
  };

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlowMode(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) {
    // Safe no-op fallback outside the provider (e.g. public pages).
    return {
      isFlowMode: false,
      remainingMs: null,
      remainingLabel: "",
      heldCount: 0,
      soundResumable: false,
      soundUnavailable: false,
      config: DEFAULT_CONFIG,
      setConfig: () => {},
      enterFlow: () => {},
      exitFlow: () => {},
      resumeSound: () => {},
    };
  }
  return ctx;
}
