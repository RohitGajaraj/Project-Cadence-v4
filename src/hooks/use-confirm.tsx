import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// In-app replacements for window.confirm / window.prompt.
// Promise-based, themed, keyboard-friendly. Mount the provider once in __root.

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  // If set, the user must type this string to enable the confirm button.
  typedConfirm?: string;
};

type PromptOptions = {
  title: string;
  body?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [promptState, setPromptState] = useState<PromptOptions | null>(null);
  const [typed, setTyped] = useState("");
  const [promptValue, setPromptValue] = useState("");
  const confirmResolver = useRef<((v: boolean) => void) | null>(null);
  const promptResolver = useRef<((v: string | null) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setTyped("");
    setConfirmState(opts);
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    setPromptValue(opts.defaultValue ?? "");
    setPromptState(opts);
    return new Promise<string | null>((resolve) => {
      promptResolver.current = resolve;
    });
  }, []);

  function resolveConfirm(v: boolean) {
    confirmResolver.current?.(v);
    confirmResolver.current = null;
    setConfirmState(null);
  }

  function resolvePrompt(v: string | null) {
    promptResolver.current?.(v);
    promptResolver.current = null;
    setPromptState(null);
  }

  const typedOk = !confirmState?.typedConfirm || typed === confirmState.typedConfirm;

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}

      <AlertDialog
        open={!!confirmState}
        onOpenChange={(o) => {
          if (!o) resolveConfirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.body && (
              <AlertDialogDescription>{confirmState.body}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {confirmState?.typedConfirm && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Type <span className="font-mono text-foreground">{confirmState.typedConfirm}</span>{" "}
                to confirm
              </Label>
              <Input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmState.typedConfirm}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConfirm(false)}>
              {confirmState?.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!typedOk}
              onClick={() => resolveConfirm(true)}
              className={
                confirmState?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {confirmState?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!promptState}
        onOpenChange={(o) => {
          if (!o) resolvePrompt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptState?.title}</DialogTitle>
            {promptState?.body && <DialogDescription>{promptState.body}</DialogDescription>}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resolvePrompt(promptValue.trim() ? promptValue.trim() : null);
            }}
            className="space-y-3"
          >
            {promptState?.label && <Label className="text-xs">{promptState.label}</Label>}
            <Input
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptState?.placeholder}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => resolvePrompt(null)}>
                {promptState?.cancelLabel ?? "Cancel"}
              </Button>
              <Button type="submit" disabled={!promptValue.trim()}>
                {promptState?.confirmLabel ?? "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("usePrompt must be used inside ConfirmProvider");
  return ctx.prompt;
}
