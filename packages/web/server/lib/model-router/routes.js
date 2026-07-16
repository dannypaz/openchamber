import express from 'express';

export function registerModelRouterRoutes(app, { getModelRouterService }) {
  app.post('/api/openchamber/model-router/resolve', express.json({ limit: '64kb' }), async (req, res) => {
    try {
      const { resolveAutoModel } = await getModelRouterService();
      const { text, directory, preferredProviderID, preferredModelID, defaultAgentModel } = req.body || {};
      const result = await resolveAutoModel({
        text,
        directory,
        preferredProviderID,
        preferredModelID,
        defaultAgentModel,
      });
      res.json(result);
    } catch (error) {
      console.error('Auto Router resolution failed:', error);
      res.status(500).json({ available: false, error: error.message || 'Auto Router resolution failed' });
    }
  });
}
