import crypto from 'node:crypto';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { createEphemeralOpenCodeTargetsRuntime } from './ephemeral-targets.js';
import { createCloudProvisioningRuntime } from './cloud-provisioning.js';

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const silentLog = { log: () => {}, warn: () => {} };

describe('cloud-provisioning', () => {
  const servers = [];
  const runtimes = [];

  afterEach(async () => {
    for (const runtime of runtimes.splice(0)) {
      runtime.stopSweeping();
    }
    for (const server of servers.splice(0)) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  const setup = async () => {
    const vmApp = express();
    vmApp.get('/global/health', (req, res) => {
      if (req.headers.authorization !== `Basic ${Buffer.from('opencode:vm-secret').toString('base64')}`) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      res.json({ healthy: true });
    });
    const vmServer = await listen(vmApp);
    servers.push(vmServer);
    const vmPort = vmServer.address().port;

    const provisionCalls = [];
    const destroyCalls = [];
    let webhookAuthTokenSeen = null;
    const provisionerApp = express();
    provisionerApp.use(express.json());
    provisionerApp.post('/provision', (req, res) => {
      provisionCalls.push(req.body);
      webhookAuthTokenSeen = req.headers.authorization;
      res.json({ host: '127.0.0.1', port: vmPort, authToken: 'vm-secret' });
    });
    provisionerApp.post('/provision-unreachable', (req, res) => {
      res.json({ host: '127.0.0.1', port: 1, authToken: 'x' });
    });
    provisionerApp.post('/destroy', (req, res) => {
      destroyCalls.push(req.body);
      res.json({ ok: true });
    });
    const provisionerServer = await listen(provisionerApp);
    servers.push(provisionerServer);
    const provisionerPort = provisionerServer.address().port;

    const probeExternalOpenCode = async (_port, origin) => {
      try {
        const response = await fetch(`${origin}/global/health`, {
          headers: { Authorization: `Basic ${Buffer.from('opencode:vm-secret').toString('base64')}` },
        });
        if (!response.ok) return false;
        const body = await response.json();
        return body?.healthy === true;
      } catch {
        return false;
      }
    };

    const ephemeralTargets = createEphemeralOpenCodeTargetsRuntime({
      crypto,
      probeExternalOpenCode,
      healthIntervalMs: 10_000,
      log: silentLog,
    });

    let cloudSettings = { enabled: false };
    const cloud = createCloudProvisioningRuntime({
      crypto,
      ephemeralTargetsRuntime: ephemeralTargets,
      getCloudProvisioningSettings: async () => cloudSettings,
      log: silentLog,
    });
    runtimes.push(cloud);

    return {
      ephemeralTargets,
      cloud,
      provisionCalls,
      destroyCalls,
      getWebhookAuthTokenSeen: () => webhookAuthTokenSeen,
      setSettings: (next) => { cloudSettings = next; },
      base: `http://127.0.0.1:${provisionerPort}`,
    };
  };

  it('rejects provisioning when cloud VMs are disabled, without calling the webhook', async () => {
    const { cloud, provisionCalls } = await setup();

    await expect(cloud.provisionCloudTarget({ sessionId: 'sess-1' })).rejects.toThrow(/not enabled/);
    expect(provisionCalls).toHaveLength(0);
  });

  it('provisions a target, registers it with the VM-scoped credential (not the infra token), and forwards metadata', async () => {
    const { cloud, ephemeralTargets, provisionCalls, getWebhookAuthTokenSeen, setSettings, base } = await setup();
    setSettings({
      enabled: true,
      provisionWebhookUrl: `${base}/provision`,
      destroyWebhookUrl: `${base}/destroy`,
      webhookAuthToken: 'infra-secret',
      idleTimeoutMinutes: 30,
      maxLifetimeMinutes: 480,
    });

    const result = await cloud.provisionCloudTarget({ sessionId: 'sess-1', metadata: { branch: 'feature/x' } });

    expect(result).toEqual({ id: 'sess-1', status: 'healthy' });
    expect(provisionCalls).toHaveLength(1);
    expect(provisionCalls[0].metadata.branch).toBe('feature/x');
    expect(getWebhookAuthTokenSeen()).toBe('Bearer infra-secret');
    expect(ephemeralTargets.getEphemeralTarget('sess-1')?.authToken).toBe('vm-secret');
    expect(cloud.listProvisioned().map((t) => t.id)).toContain('sess-1');
  });

  it('destroy deregisters locally and calls the destroy webhook exactly once per owned target', async () => {
    const { cloud, ephemeralTargets, destroyCalls, setSettings, base } = await setup();
    setSettings({
      enabled: true,
      provisionWebhookUrl: `${base}/provision`,
      destroyWebhookUrl: `${base}/destroy`,
    });
    await cloud.provisionCloudTarget({ sessionId: 'sess-1' });

    const result = await cloud.destroyCloudTarget('sess-1', { force: true });
    expect(result).toMatchObject({ deregistered: true, destroyWebhookCalled: true });
    expect(destroyCalls).toEqual([{ sessionId: 'sess-1', force: true }]);
    expect(ephemeralTargets.getEphemeralTarget('sess-1')).toBeNull();
    expect(cloud.listProvisioned().map((t) => t.id)).not.toContain('sess-1');

    const second = await cloud.destroyCloudTarget('sess-1', {});
    expect(second.deregistered).toBe(false);
    expect(destroyCalls).toHaveLength(1);
  });

  it('never registers a target whose returned VM fails its health probe', async () => {
    const { cloud, ephemeralTargets, setSettings, base } = await setup();
    setSettings({
      enabled: true,
      provisionWebhookUrl: `${base}/provision-unreachable`,
    });

    await expect(cloud.provisionCloudTarget({ sessionId: 'sess-bad' })).rejects.toThrow(/health check/);
    expect(ephemeralTargets.getEphemeralTarget('sess-bad')).toBeNull();
  });
});
