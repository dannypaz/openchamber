// Thin HTTP surface over ephemeral-targets.js's registry. Provisioning and
// destroying the underlying VM is the caller's own infra — these routes only
// register/deregister/list the resulting {host, port, authToken} so the
// OpenCode proxy (proxy.js) can route requests carrying an
// x-opencode-target header to it.

export const registerEphemeralTargetRoutes = (app, dependencies) => {
  const {
    express,
    registerEphemeralTarget,
    deregisterEphemeralTarget,
    listEphemeralTargets,
  } = dependencies;

  app.post('/api/openchamber/ephemeral-targets', express.json(), async (req, res) => {
    const { id, host, port, authToken, authUsername } = req.body || {};

    if (typeof host !== 'string' || !host.trim()) {
      res.status(400).json({ error: 'host is required' });
      return;
    }

    const numericPort = Number.parseInt(port, 10);
    if (!Number.isFinite(numericPort) || numericPort <= 0) {
      res.status(400).json({ error: 'port must be a positive integer' });
      return;
    }

    try {
      const result = await registerEphemeralTarget({
        id: typeof id === 'string' ? id : undefined,
        host: host.trim(),
        port: numericPort,
        authToken: typeof authToken === 'string' ? authToken : '',
        authUsername: typeof authUsername === 'string' ? authUsername : '',
      });
      res.status(201).json(result);
    } catch (error) {
      console.error('[ephemeral-targets] registration failed:', error?.message ?? error);
      res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to register ephemeral target' });
    }
  });

  app.delete('/api/openchamber/ephemeral-targets/:id', (req, res) => {
    const removed = deregisterEphemeralTarget(req.params.id);
    res.status(200).json({ id: req.params.id, removed });
  });

  app.get('/api/openchamber/ephemeral-targets', (_req, res) => {
    res.json({ targets: listEphemeralTargets() });
  });
};
