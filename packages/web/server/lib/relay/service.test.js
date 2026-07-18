import { afterEach, describe, expect, it } from 'bun:test';
import crypto from 'node:crypto';

import { createRelayService } from './service.js';

const makeSettingsStore = (initial = {}) => {
  let settings = initial;
  return {
    readSettingsFromDiskMigrated: async () => settings,
    writeSettingsToDisk: async (next) => { settings = next; },
    readSettingsStrict: async () => settings,
    peek: () => settings,
  };
};

const makeService = (overrides = {}) => {
  const store = makeSettingsStore(overrides.initialSettings);
  return createRelayService({
    crypto,
    readSettingsFromDiskMigrated: store.readSettingsFromDiskMigrated,
    writeSettingsToDisk: store.writeSettingsToDisk,
    readSettingsStrict: store.readSettingsStrict,
    getLocalPort: () => 3001,
    hasRelayDemand: overrides.hasRelayDemand ?? (async () => true),
    logger: { warn: () => {} },
    ...overrides,
  });
};

afterEach(() => {
  delete process.env.OPENCHAMBER_RELAY_ENABLED;
});

describe('relay service disabled by default', () => {
  it('stays disabled on reconcile() even when demand is present', async () => {
    const service = makeService({ hasRelayDemand: async () => true });
    await service.reconcile();
    const status = await service.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.state).toBe('disabled');
  });

  it('ensureEnabledForPairing() returns null instead of starting the host', async () => {
    const service = makeService();
    const candidate = await service.ensureEnabledForPairing();
    expect(candidate).toBeNull();
    const status = await service.getStatus();
    expect(status.enabled).toBe(false);
  });

  it('force-disables and stops a previously-enabled relay on reconcile()', async () => {
    const service = makeService({
      initialSettings: { privateRelay: { enabled: true, relayUrl: 'wss://relay.openchamber.dev/ws' } },
      hasRelayDemand: async () => true,
    });
    await service.reconcile();
    const status = await service.getStatus();
    expect(status.enabled).toBe(false);
  });
});

describe('relay service opted in via OPENCHAMBER_RELAY_ENABLED', () => {
  it('reconcile() enables the relay when demand is present', async () => {
    process.env.OPENCHAMBER_RELAY_ENABLED = 'true';
    const service = makeService({ hasRelayDemand: async () => true });
    try {
      await service.reconcile();
      const status = await service.getStatus();
      expect(status.enabled).toBe(true);
    } finally {
      service.stop();
    }
  });
});
