import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";
import {
  consentDefaultScript,
  CONSENT_STORAGE_KEY,
  type ConsentModeState,
} from "@/lib/marketing-consent";

/**
 * Run the head bootstrap the way a browser would and hand back what it put on
 * the dataLayer, so the mapping is tested rather than the source text.
 */
function runBootstrap(stored: string | null) {
  const dataLayer: unknown[] = [];
  const localStorage = {
    getItem: (key: string) => (key === CONSENT_STORAGE_KEY ? stored : null),
  };
  const window = { dataLayer, localStorage } as Record<string, unknown>;
  const sandbox: Record<string, unknown> = { window, dataLayer, localStorage };

  vm.createContext(sandbox);
  vm.runInContext(consentDefaultScript(), sandbox);

  const entry = dataLayer[0] as ArrayLike<unknown> | undefined;
  assert.ok(entry, "the bootstrap must push a consent call");
  const call = Array.from(entry) as [string, string, ConsentModeState];
  return { call, sandbox, window };
}

/** Consent Mode state plus the update window the bootstrap sets. */
type DefaultCall = ConsentModeState & { wait_for_update: number };

const DENIED: DefaultCall = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  wait_for_update: 500,
};

function stored(choice: { analytics: boolean; marketing: boolean }) {
  return JSON.stringify({ ...choice, updatedAt: "2026-09-21T00:00:00.000Z" });
}

describe("consent mode head bootstrap", () => {
  it("sets every signal to denied for a first-time visitor", () => {
    const { call } = runBootstrap(null);
    assert.equal(call[0], "consent");
    assert.equal(call[1], "default");
    // wait_for_update rides along so a fast banner click still counts.
    assert.deepEqual({ ...call[2] }, DENIED);
  });

  it("applies a stored acceptance, so a returning visitor is not denied", () => {
    const { call } = runBootstrap(stored({ analytics: true, marketing: true }));
    assert.deepEqual({ ...call[2] }, {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      wait_for_update: 500,
    } as DefaultCall);
  });

  it("keeps analytics and marketing independent", () => {
    const { call } = runBootstrap(stored({ analytics: true, marketing: false }));
    assert.equal(call[2].analytics_storage, "granted");
    assert.equal(call[2].ad_storage, "denied");
    assert.equal(call[2].ad_user_data, "denied");
    assert.equal(call[2].ad_personalization, "denied");
  });

  it("still sets the default when the stored value is corrupt", () => {
    const { call } = runBootstrap("{not json");
    assert.deepEqual({ ...call[2] }, DENIED);
  });

  it("ignores a stored value with the wrong shape", () => {
    const { call } = runBootstrap(JSON.stringify({ analytics: "yes" }));
    assert.deepEqual({ ...call[2] }, DENIED);
  });

  it("leaves a gtag shim and dataLayer behind for later tags", () => {
    const { sandbox, window } = runBootstrap(null);
    assert.equal(typeof sandbox.gtag, "function");
    assert.equal(typeof window.gtag, "function");
    assert.ok(Array.isArray(window.dataLayer));
  });
});
