// Flow-aware notification facade over sonner.
//
// Engine-Room: the hold/summary buffer is machinery; nothing in the UI exposes
// it. Callers keep writing `toast.success(...)` exactly as before; the only
// change is the import source. When Flow mode is on, non-urgent toasts are held
// quietly and replayed as a one-line summary on exit (see use-flow-mode.tsx).
// Urgent ones (errors, warnings, or anything marked `critical`) always show.
//
// Why a facade instead of intercepting sonner: there is no single chokepoint in
// sonner to pause toasts, and we want errors to keep flowing while flow is on.
// Routing every call through here gives that with one import swap per file.

import type { ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

export type HeldKind = "success" | "info" | "message" | "default";

export type HeldNotification = { type: HeldKind; title: string; at: number };

export type NotifyOptions = ExternalToast & {
  // Opt a non-error toast back into always-showing, even during Flow mode.
  // Use sparingly: approvals and other "this needs you now" moments.
  critical?: boolean;
};

let flowActive = false;
let heldIdSeq = -1; // synthetic ids for held toasts; negative never hits sonner
const buffer: HeldNotification[] = [];

// Kept React-free on purpose: use-flow-mode.tsx calls this from an effect so the
// facade has no dependency on React or the provider being mounted (public pages
// have no provider, so flowActive stays false and everything passes through).
export function setFlowActive(active: boolean): void {
  flowActive = active;
}

export function isFlowActive(): boolean {
  return flowActive;
}

export function heldCount(): number {
  return buffer.length;
}

// Returns and clears the held toasts. The provider calls this on flow exit to
// build the "while you were focused" summary.
export function drainHeldNotifications(): { count: number; items: HeldNotification[] } {
  const items = buffer.splice(0, buffer.length);
  return { count: items.length, items };
}

function titleOf(message: unknown): string {
  if (typeof message === "string") return message;
  if (typeof message === "number") return String(message);
  return "";
}

function isCritical(opts?: NotifyOptions): boolean {
  return Boolean(opts && opts.critical);
}

// sonner does not know about our `critical` flag; drop it before handing over.
function stripCritical(opts?: NotifyOptions): ExternalToast | undefined {
  if (!opts) return opts;
  if (!("critical" in opts)) return opts;
  const { critical: _critical, ...rest } = opts;
  return rest;
}

function shouldHold(opts?: NotifyOptions): boolean {
  return flowActive && !isCritical(opts);
}

function hold(kind: HeldKind, message: unknown): number {
  buffer.push({ type: kind, title: titleOf(message), at: Date.now() });
  return heldIdSeq--;
}

type ToastFn = (message: ReactNode | (() => ReactNode), opts?: NotifyOptions) => string | number;

function heldable(kind: Exclude<HeldKind, "default">, fn: typeof sonnerToast.success): ToastFn {
  return (message, opts) => {
    if (shouldHold(opts)) return hold(kind, message);
    return fn(message as Parameters<typeof fn>[0], stripCritical(opts));
  };
}

const base: ToastFn = (message, opts) => {
  if (shouldHold(opts)) return hold("default", message);
  return sonnerToast(message as Parameters<typeof sonnerToast>[0], stripCritical(opts));
};

export interface NotifyToast extends ToastFn {
  success: ToastFn;
  info: ToastFn;
  message: ToastFn;
  // Always-through: errors and warnings are never quieted; loading/promise/
  // dismiss/custom are plumbing, not interruptions.
  error: typeof sonnerToast.error;
  warning: typeof sonnerToast.warning;
  loading: typeof sonnerToast.loading;
  promise: typeof sonnerToast.promise;
  dismiss: typeof sonnerToast.dismiss;
  custom: typeof sonnerToast.custom;
}

export const toast: NotifyToast = Object.assign(base, {
  success: heldable("success", sonnerToast.success),
  info: heldable("info", sonnerToast.info),
  message: heldable("message", sonnerToast.message),
  error: sonnerToast.error.bind(sonnerToast),
  warning: sonnerToast.warning.bind(sonnerToast),
  loading: sonnerToast.loading.bind(sonnerToast),
  promise: sonnerToast.promise.bind(sonnerToast),
  dismiss: sonnerToast.dismiss.bind(sonnerToast),
  custom: sonnerToast.custom.bind(sonnerToast),
}) as NotifyToast;
