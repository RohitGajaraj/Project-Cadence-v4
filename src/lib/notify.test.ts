import { beforeEach, describe, expect, mock, test } from "bun:test";

// Mock sonner so the facade can be exercised without a DOM / real renderer.
type Recorded = { method: string; message: unknown; opts: unknown };
const calls: Recorded[] = [];
function record(method: string) {
  return (message: unknown, opts?: unknown) => {
    calls.push({ method, message, opts });
    return `id-${calls.length}`;
  };
}
const fakeToast = Object.assign(record("default"), {
  success: record("success"),
  info: record("info"),
  message: record("message"),
  error: record("error"),
  warning: record("warning"),
  loading: record("loading"),
  promise: record("promise"),
  dismiss: record("dismiss"),
  custom: record("custom"),
});

mock.module("sonner", () => ({ toast: fakeToast, Toaster: () => null }));

const { toast, setFlowActive, isFlowActive, heldCount, drainHeldNotifications } =
  await import("./notify");

beforeEach(() => {
  calls.length = 0;
  setFlowActive(false);
  drainHeldNotifications(); // clear any leftover buffer
});

describe("notify facade — flow inactive", () => {
  test("every kind passes straight through to sonner, nothing held", () => {
    toast.success("a");
    toast.info("b");
    toast("c");
    toast.error("e");
    expect(heldCount()).toBe(0);
    expect(calls.map((c) => c.method)).toEqual(["success", "info", "default", "error"]);
  });
});

describe("notify facade — flow active", () => {
  beforeEach(() => setFlowActive(true));

  test("non-urgent kinds (success/info/message/default) are held, not rendered", () => {
    toast.success("a");
    toast.info("b");
    toast.message("c");
    toast("d");
    expect(heldCount()).toBe(4);
    expect(calls.length).toBe(0);
  });

  test("errors and warnings always pass through", () => {
    toast.error("boom");
    toast.warning("careful");
    expect(heldCount()).toBe(0);
    expect(calls.map((c) => c.method)).toEqual(["error", "warning"]);
  });

  test("a critical-flagged toast passes through, with the flag stripped", () => {
    toast.success("approval needed", { critical: true, description: "x" });
    expect(heldCount()).toBe(0);
    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe("success");
    expect(calls[0].opts).toEqual({ description: "x" });
    expect(calls[0].opts).not.toHaveProperty("critical");
  });

  test("drain returns the held items in order and clears the buffer", () => {
    toast.success("a");
    toast("b");
    const drained = drainHeldNotifications();
    expect(drained.count).toBe(2);
    expect(drained.items.map((i) => i.type)).toEqual(["success", "default"]);
    expect(drained.items.map((i) => i.title)).toEqual(["a", "b"]);
    expect(heldCount()).toBe(0);
  });
});

describe("setFlowActive / isFlowActive", () => {
  test("reflects the active flag", () => {
    setFlowActive(true);
    expect(isFlowActive()).toBe(true);
    setFlowActive(false);
    expect(isFlowActive()).toBe(false);
  });
});
