// Orchestrates calling out to a user-configured cloud VM provisioner
// (webhook-based) and composing the result with ephemeral-targets.js's
// registry. Layered ON TOP of, not modifying, that module — direct API
// clients can keep driving /api/openchamber/ephemeral-targets themselves
// regardless of what this module does.
//
// Mirrors the credential-separation pattern from Anthropic's Claude Managed
// Agents self-hosted sandboxes: the credential used to call *your*
// provisioner (webhookAuthToken) is a distinct, higher-privilege secret from
// the per-VM OpenCode password the provisioner hands back — the former is
// never forwarded into the VM, only used for the OpenChamber-server-to-
// provisioner hop.

const PROVISION_TIMEOUT_MS = 30_000;
const DESTROY_TIMEOUT_MS = 15_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

export const createCloudProvisioningRuntime = (deps) => {
  const {
    crypto,
    fetchImpl = fetch,
    ephemeralTargetsRuntime,
    getCloudProvisioningSettings,
    log = console,
  } = deps;

  // Targets provisioned through this module, so their teardown knows to call
  // the destroy webhook. Targets registered directly via the low-level
  // ephemeral-targets routes (no provisioner involved) are intentionally not
  // tracked here — this module only owns targets IT created.
  const provisionedAt = new Map();

  const callWebhook = async (url, body, { timeoutMs, authToken }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Provisioner webhook responded with status ${response.status}`);
      }
      return await response.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }
  };

  const provisionCloudTarget = async ({ sessionId, metadata } = {}) => {
    // Settings are disk-backed and read async throughout this codebase
    // (readSettingsFromDiskMigrated) — never assume a synchronous accessor.
    const settings = await getCloudProvisioningSettings();
    if (!settings?.enabled) {
      throw new Error('Cloud VMs are not enabled');
    }
    if (!settings.provisionWebhookUrl) {
      throw new Error('No provisioning webhook is configured');
    }

    const targetId = typeof sessionId === 'string' && sessionId.trim()
      ? sessionId.trim()
      : crypto.randomBytes(16).toString('hex');

    const payload = await callWebhook(settings.provisionWebhookUrl, {
      sessionId: targetId,
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
    }, { timeoutMs: PROVISION_TIMEOUT_MS, authToken: settings.webhookAuthToken });

    const host = typeof payload?.host === 'string' ? payload.host.trim() : '';
    const port = Number(payload?.port);
    if (!host || !Number.isFinite(port) || port <= 0) {
      throw new Error('Provisioning webhook returned an invalid { host, port } response');
    }

    // registerEphemeralTarget health-probes before returning — if the VM
    // isn't actually reachable yet, this throws and we never mark it
    // provisioned, matching the "no silent partial success" invariant.
    const result = await ephemeralTargetsRuntime.registerEphemeralTarget({
      id: targetId,
      host,
      port,
      authToken: typeof payload?.authToken === 'string' ? payload.authToken : '',
    });

    provisionedAt.set(targetId, Date.now());
    log.log?.(`[cloud-provisioning] provisioned "${targetId}" at ${host}:${port}`);
    return result;
  };

  const destroyCloudTarget = async (id, { force = false } = {}) => {
    const settings = await getCloudProvisioningSettings();
    const wasRegistered = ephemeralTargetsRuntime.deregisterEphemeralTarget(id);
    const wasProvisionedHere = provisionedAt.delete(id);

    if (!settings?.destroyWebhookUrl || !wasProvisionedHere) {
      // Nothing to call back for a target this module didn't provision, or
      // no destroy webhook configured — local deregistration already ran.
      return { deregistered: wasRegistered, destroyWebhookCalled: false };
    }

    try {
      await callWebhook(settings.destroyWebhookUrl, { sessionId: id, force: Boolean(force) }, {
        timeoutMs: DESTROY_TIMEOUT_MS,
        authToken: settings.webhookAuthToken,
      });
      log.log?.(`[cloud-provisioning] destroyed "${id}"${force ? ' (forced)' : ''}`);
      return { deregistered: wasRegistered, destroyWebhookCalled: true };
    } catch (error) {
      log.warn?.(`[cloud-provisioning] destroy webhook failed for "${id}":`, error?.message ?? error);
      return { deregistered: wasRegistered, destroyWebhookCalled: false, error: error?.message ?? String(error) };
    }
  };

  let idleSweepTimer = null;
  let maxLifetimeSweepTimer = null;

  const stopSweeping = () => {
    if (idleSweepTimer) {
      clearInterval(idleSweepTimer);
      idleSweepTimer = null;
    }
    if (maxLifetimeSweepTimer) {
      clearInterval(maxLifetimeSweepTimer);
      maxLifetimeSweepTimer = null;
    }
  };

  const startSweeping = ({ intervalMs = DEFAULT_SWEEP_INTERVAL_MS } = {}) => {
    stopSweeping();

    idleSweepTimer = setInterval(() => {
      void (async () => {
        const settings = await getCloudProvisioningSettings();
        if (!settings?.enabled || !Number.isFinite(settings.idleTimeoutMinutes)) return;
        ephemeralTargetsRuntime.sweepIdleTargets(settings.idleTimeoutMinutes * 60_000, (id) => {
          log.log?.(`[cloud-provisioning] idle timeout, destroying "${id}"`);
          void destroyCloudTarget(id, { force: true }).catch(() => {});
        });
      })().catch((error) => log.warn?.('[cloud-provisioning] idle sweep tick failed:', error?.message ?? error));
    }, intervalMs);
    idleSweepTimer.unref?.();

    // New logic with no Phase 1 analog: a hard ceiling regardless of
    // activity, mirroring Lambda MicroVMs' fixed runtime cap.
    maxLifetimeSweepTimer = setInterval(() => {
      void (async () => {
        const settings = await getCloudProvisioningSettings();
        if (!settings?.enabled || !Number.isFinite(settings.maxLifetimeMinutes)) return;
        const cutoff = Date.now() - settings.maxLifetimeMinutes * 60_000;
        for (const [id, createdAt] of provisionedAt.entries()) {
          if (createdAt <= cutoff) {
            log.log?.(`[cloud-provisioning] max lifetime reached, destroying "${id}"`);
            void destroyCloudTarget(id, { force: true }).catch(() => {});
          }
        }
      })().catch((error) => log.warn?.('[cloud-provisioning] max-lifetime sweep tick failed:', error?.message ?? error));
    }, intervalMs);
    maxLifetimeSweepTimer.unref?.();
  };

  // Best-effort teardown of every target this module provisioned, isolated
  // per-id so one failing destroy webhook never blocks the rest — used on
  // server shutdown.
  const disposeAll = async () => {
    stopSweeping();
    const ids = Array.from(provisionedAt.keys());
    for (const id of ids) {
      try {
        await destroyCloudTarget(id, { force: true });
      } catch (error) {
        log.warn?.(`[cloud-provisioning] dispose failed for "${id}":`, error?.message ?? error);
      }
    }
    return ids;
  };

  // Cloud-provisioned target ids only — a subset of ephemeral-targets.js's
  // full registry, which also includes targets registered directly via the
  // low-level /api/openchamber/ephemeral-targets routes with no provisioner
  // involved at all.
  const listProvisioned = () => Array.from(provisionedAt.entries()).map(([id, createdAt]) => ({ id, createdAt }));

  return {
    provisionCloudTarget,
    destroyCloudTarget,
    startSweeping,
    stopSweeping,
    disposeAll,
    listProvisioned,
  };
};
