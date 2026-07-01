import { expect, test, describe } from "bun:test";
import {
  nullAppRuntimeProvider,
  RESERVED_APP_RUNTIME_PROVIDER_IDS,
  APP_RUNTIME_DISABLED_REASON,
  type AppRuntimeRef,
  type AppRuntimeSpec,
  type AppRuntimeHandle,
} from "./provider";

const REF: AppRuntimeRef = {
  workspaceId: "ws_1",
  productId: "prod_1",
  hostedAppId: "app_1",
};

const SPEC: AppRuntimeSpec = { dedicatedDb: false };

const HANDLE: AppRuntimeHandle = { providerId: "cloudflare-wfp", ref: REF };

describe("nullAppRuntimeProvider (the dormant floor)", () => {
  test("is never available", () => {
    expect(nullAppRuntimeProvider.available).toBe(false);
    expect(nullAppRuntimeProvider.providerId).toBe("cloudflare-wfp");
  });

  test("every method refuses with the same clear reason, never a silent no-op", async () => {
    await expect(nullAppRuntimeProvider.provisionApp(REF, SPEC)).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.deploy(HANDLE, { files: [] }, {})).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.readDeployments(HANDLE)).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.readHealth(HANDLE)).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.readLogs(HANDLE)).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.readEnvVars(HANDLE)).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.setEnvVar(HANDLE, "K", "V")).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.rollback(HANDLE, "dep_1")).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.exportTenantData(HANDLE)).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
    await expect(nullAppRuntimeProvider.teardown(HANDLE)).rejects.toThrow(
      APP_RUNTIME_DISABLED_REASON,
    );
  });
});

describe("reserved provider ids", () => {
  test("names every backend from the plan, none wired yet (P5a ships zero live adapters)", () => {
    expect(RESERVED_APP_RUNTIME_PROVIDER_IDS).toContain("cloudflare-wfp");
    expect(RESERVED_APP_RUNTIME_PROVIDER_IDS).toContain("neon-silo");
    expect(RESERVED_APP_RUNTIME_PROVIDER_IDS).toContain("supabase-for-platforms");
    expect(RESERVED_APP_RUNTIME_PROVIDER_IDS.length).toBe(3);
  });
});
