import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type MachineViewCtx = {
  isMachineView: boolean;
  toggle: () => void;
};

const MachineViewContext = createContext<MachineViewCtx>({
  isMachineView: false,
  toggle: () => {},
});

// Persists across navigation via localStorage; ?view=machine URL param also activates
// it so agents can bookmark a stable machine-mode URL.
export function MachineViewProvider({ children }: { children: ReactNode }) {
  const [isMachineView, setIsMachineView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("view");
    const stored = localStorage.getItem("cadence-machine-view");
    setIsMachineView(param === "machine" || stored === "machine");
  }, []);

  const toggle = () => {
    setIsMachineView((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("cadence-machine-view", next ? "machine" : "human");
      }
      return next;
    });
  };

  return (
    <MachineViewContext.Provider value={{ isMachineView, toggle }}>
      {children}
    </MachineViewContext.Provider>
  );
}

export function useMachineView() {
  return useContext(MachineViewContext);
}
