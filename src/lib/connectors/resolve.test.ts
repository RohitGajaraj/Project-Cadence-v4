import { expect, test, describe } from "bun:test";
import { bindingConnectionAllowed } from "./resolve.server";

// KI-34: before resolveProviderAuth materializes the credential of a connection
// referenced by a workspace binding, it verifies the connection's owner is a
// member of the binding's workspace. This pure decision encodes the policy:
// block only a DEFINITIVELY cross-tenant owner; fail OPEN on any lookup error so
// a transient failure can never break a legitimate integration.
describe("KI-34: bindingConnectionAllowed (cross-tenant credential guard)", () => {
  test("allows when the connection owner is a member of the binding's workspace", () => {
    expect(bindingConnectionAllowed({ errored: false, isMember: true })).toBe(true);
  });

  test("BLOCKS when the owner is definitively NOT a member (the cross-tenant attack)", () => {
    expect(bindingConnectionAllowed({ errored: false, isMember: false })).toBe(false);
  });

  test("fails OPEN on a lookup error (never breaks a legit integration; the RLS migration is the backstop)", () => {
    expect(bindingConnectionAllowed({ errored: true, isMember: false })).toBe(true);
    expect(bindingConnectionAllowed({ errored: true, isMember: true })).toBe(true);
  });
});
