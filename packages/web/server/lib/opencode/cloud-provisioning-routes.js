// Thin HTTP surface over cloud-provisioning.js. This is the UI-facing path
// ("open a chat, pick Cloud") — the lower-level
// /api/openchamber/ephemeral-targets routes (ephemeral-target-routes.js)
// remain available unchanged for direct/manual driving of infra that's
// already provisioned outside of this flow.

export const registerCloudProvisioningRoutes = (app, dependencies) => {
  const {
    express,
    provisionCloudTarget,
    destroyCloudTarget,
    listProvisioned,
    getEphemeralTarget,
  } = dependencies;

  app.post('/api/openchamber/cloud-sessions', express.json(), async (req, res) => {
    const { sessionId, metadata } = req.body || {};

    if (sessionId !== undefined && typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId must be a string' });
      return;
    }
    if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
      res.status(400).json({ error: 'metadata must be an object' });
      return;
    }

    try {
      const result = await provisionCloudTarget({ sessionId, metadata });
      res.status(201).json(result);
    } catch (error) {
      console.error('[cloud-provisioning] provisioning failed:', error?.message ?? error);
      res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to provision cloud VM' });
    }
  });

  app.delete('/api/openchamber/cloud-sessions/:id', async (req, res) => {
    const force = req.query?.force === 'true';
    const result = await destroyCloudTarget(req.params.id, { force });
    res.status(200).json({ id: req.params.id, ...result });
  });

  app.get('/api/openchamber/cloud-sessions', (_req, res) => {
    const sessions = listProvisioned().map(({ id, createdAt }) => {
      const target = getEphemeralTarget(id);
      return {
        id,
        createdAt,
        status: target?.status ?? 'unknown',
        lastActivityAt: target?.lastActivityAt ?? null,
        lastError: target?.lastError ?? null,
      };
    });
    res.json({ sessions });
  });
};
