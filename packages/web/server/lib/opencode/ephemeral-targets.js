// Registry for ephemeral OpenCode backends (e.g. one per-session cloud
// microVM provisioned by external infra) that OpenChamber connects to at
// runtime, in addition to the one default managed/external target tracked by
// lifecycle.js. Deliberately additive and independent: a target registered or
// torn down here never touches openCodeLifecycleState, and one target's
// health/lifecycle never affects another's.
//
// Provisioning and destroying the underlying VM is the caller's
// responsibility — this module only tracks reachability and credentials for
// targets that already exist.

const DEFAULT_HEALTH_INTERVAL_MS = 15000;

export const createEphemeralOpenCodeTargetsRuntime = (deps) => {
  const {
    crypto,
    probeExternalOpenCode,
    // Each ephemeral target carries its own provisioner-issued credential,
    // never the default backend's — probing (or proxying to) it must use
    // this, not the plain probeExternalOpenCode default. See auth-state-
    // runtime.js's getOpenCodeAuthHeadersFor, already used this way by
    // proxy.js for the request-forwarding path; this wires the same
    // function into the health-check path, which was missed in the
    // original registration/health-loop wiring.
    getOpenCodeAuthHeadersFor,
    healthIntervalMs = DEFAULT_HEALTH_INTERVAL_MS,
    log = console,
  } = deps;

  const targets = new Map();

  const now = () => Date.now();

  const clearHealthTimer = (target) => {
    if (target.healthTimer) {
      clearInterval(target.healthTimer);
      target.healthTimer = null;
    }
  };

  const startHealthLoop = (target) => {
    clearHealthTimer(target);
    const timer = setInterval(async () => {
      const current = targets.get(target.id);
      if (!current) {
        clearInterval(timer);
        return;
      }
      const healthy = await probeExternalOpenCode(current.port, current.baseUrl, getOpenCodeAuthHeadersFor(current)).catch(() => false);
      const stillPresent = targets.get(target.id);
      if (!stillPresent) return;
      stillPresent.lastHealthAt = now();
      stillPresent.status = healthy ? 'healthy' : 'unhealthy';
      if (!healthy) {
        stillPresent.lastError = `Health check failed for ephemeral target "${target.id}"`;
        log.warn?.(`[ephemeral-targets] "${target.id}" is unhealthy at ${current.baseUrl}`);
      }
    }, healthIntervalMs);
    timer.unref?.();
    target.healthTimer = timer;
  };

  const registerEphemeralTarget = async ({ id, host, port, authToken, authUsername, directory } = {}) => {
    const trimmedHost = typeof host === 'string' ? host.trim() : '';
    if (!trimmedHost) {
      throw new Error('registerEphemeralTarget requires a host');
    }

    const numericPort = Number.parseInt(port, 10);
    if (!Number.isFinite(numericPort) || numericPort <= 0) {
      throw new Error('registerEphemeralTarget requires a valid port');
    }

    const targetId = typeof id === 'string' && id.trim() ? id.trim() : crypto.randomBytes(16).toString('hex');
    if (targets.has(targetId)) {
      throw new Error(`Ephemeral target "${targetId}" is already registered`);
    }

    const baseUrl = `http://${trimmedHost}:${numericPort}`;
    const healthy = await probeExternalOpenCode(numericPort, baseUrl, getOpenCodeAuthHeadersFor({ authToken, authUsername }));
    if (!healthy) {
      throw new Error(`Ephemeral target "${targetId}" failed its initial health check at ${baseUrl}`);
    }

    const createdAt = now();
    const target = {
      id: targetId,
      host: trimmedHost,
      port: numericPort,
      baseUrl,
      authToken: typeof authToken === 'string' ? authToken : '',
      authUsername: typeof authUsername === 'string' ? authUsername : '',
      // The working directory OpenCode is serving on this target — required
      // for callers to route session.create/x-opencode-directory requests at
      // it (see cloud-provisioning.js, which sources this from the
      // provisioning webhook response). Optional here since direct callers of
      // this lower-level registry (ephemeral-target-routes.js) may already
      // know the directory out-of-band.
      directory: typeof directory === 'string' ? directory : '',
      status: 'healthy',
      createdAt,
      lastActivityAt: createdAt,
      lastHealthAt: createdAt,
      lastError: null,
      healthTimer: null,
    };

    targets.set(targetId, target);
    startHealthLoop(target);
    log.log?.(`[ephemeral-targets] registered "${targetId}" at ${baseUrl}`);

    return { id: target.id, status: target.status, directory: target.directory };
  };

  const deregisterEphemeralTarget = (id) => {
    const target = targets.get(id);
    if (!target) {
      return false;
    }
    clearHealthTimer(target);
    targets.delete(id);
    log.log?.(`[ephemeral-targets] deregistered "${id}"`);
    return true;
  };

  const getEphemeralTarget = (id) => {
    if (typeof id !== 'string' || !id) {
      return null;
    }
    return targets.get(id) ?? null;
  };

  const touchEphemeralTargetActivity = (id) => {
    const target = targets.get(id);
    if (target) {
      target.lastActivityAt = now();
    }
  };

  const listEphemeralTargets = () => Array.from(targets.values()).map((target) => ({
    id: target.id,
    host: target.host,
    port: target.port,
    directory: target.directory,
    status: target.status,
    createdAt: target.createdAt,
    lastActivityAt: target.lastActivityAt,
    lastHealthAt: target.lastHealthAt,
    lastError: target.lastError,
  }));

  // No existing analog covers "session abandoned without an explicit close" —
  // callers that want a TTL sweep run this periodically with their own
  // threshold and teardown callback (e.g. to also invoke the provisioner's
  // destroy()); it is not scheduled automatically by this module.
  const sweepIdleTargets = (maxIdleMs, onIdle) => {
    const cutoff = now() - maxIdleMs;
    for (const target of targets.values()) {
      if (target.lastActivityAt <= cutoff) {
        deregisterEphemeralTarget(target.id);
        try {
          onIdle?.(target.id);
        } catch (error) {
          log.warn?.(`[ephemeral-targets] idle-sweep callback failed for "${target.id}":`, error?.message ?? error);
        }
      }
    }
  };

  // Best-effort teardown of every still-registered target, isolated per-id so
  // one failing entry never blocks the rest — used on server shutdown.
  const disposeAll = () => {
    const ids = Array.from(targets.keys());
    for (const id of ids) {
      try {
        deregisterEphemeralTarget(id);
      } catch (error) {
        log.warn?.(`[ephemeral-targets] dispose failed for "${id}":`, error?.message ?? error);
      }
    }
    return ids;
  };

  return {
    registerEphemeralTarget,
    deregisterEphemeralTarget,
    getEphemeralTarget,
    touchEphemeralTargetActivity,
    listEphemeralTargets,
    sweepIdleTargets,
    disposeAll,
  };
};
