import fs from 'fs';
import os from 'os';
import path from 'path';
import { classifyMessageTier } from './classify.js';
import { resolveTierModel } from './resolve.js';
import { parseModelRef } from '../small-model/resolve.js';

const OPENCHAMBER_SETTINGS_FILE = path.join(
  process.env.OPENCHAMBER_DATA_DIR
    ? path.resolve(process.env.OPENCHAMBER_DATA_DIR)
    : path.join(os.homedir(), '.config', 'openchamber'),
  'settings.json',
);

// OpenChamber's own settings overrides for the two Auto Router tiers. Mirrors
// small-model's readSmallModelSettingsOverride: presence of a non-empty
// "provider/model" string is precedence-sufficient, no separate boolean.
const readModelRouterSettingsOverrides = () => {
  try {
    const raw = fs.readFileSync(OPENCHAMBER_SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(raw);
    if (!settings || typeof settings !== 'object') {
      return { cheapOverride: null, frontierOverride: null };
    }
    const cheap = typeof settings.modelRouterCheapOverride === 'string' ? settings.modelRouterCheapOverride.trim() : '';
    const frontier = typeof settings.modelRouterFrontierOverride === 'string' ? settings.modelRouterFrontierOverride.trim() : '';
    return {
      cheapOverride: cheap || null,
      frontierOverride: frontier || null,
    };
  } catch {
    return { cheapOverride: null, frontierOverride: null };
  }
};

/**
 * Resolves the Auto Router "Auto" sentinel to a concrete {providerID,
 * modelID} pair for one message: classifies the message tier (reusing the
 * Small Model resolution as the cheap-tier candidate), then applies
 * per-tier settings overrides / fallbacks.
 *
 * `defaultAgentModel` is the client's own already-resolved non-Auto default
 * (project/settings default, agent-pinned model, etc.) — that cascade lives
 * entirely client-side, so the server does not re-derive it.
 *
 * Never throws. `available: false` means no model could be resolved at all
 * (no classifier, no overrides, no usable default) — callers fall back to
 * their own default-model resolution in that case.
 */
export async function resolveAutoModel({ text, directory, preferredProviderID, preferredModelID, defaultAgentModel }) {
  const { cheapOverride, frontierOverride } = readModelRouterSettingsOverrides();

  const classified = await classifyMessageTier({ text, directory, preferredProviderID, preferredModelID });
  // A failed/unparseable classification never resolves to the cheap tier —
  // it forces the frontier tier so cost mistakes lean expensive-but-correct,
  // not cheap-but-wrong.
  const tier = classified?.tier === 'simple' ? 'simple' : 'complex';

  const resolved = resolveTierModel({
    tier,
    cheapOverrideRef: cheapOverride,
    frontierOverrideRef: frontierOverride,
    cheapFallback: classified ? { providerID: classified.providerID, modelID: classified.modelID } : null,
    frontierFallback: parseModelRef(defaultAgentModel),
  });

  if (!resolved) {
    return { available: false };
  }

  return {
    available: true,
    tier,
    providerID: resolved.providerID,
    modelID: resolved.modelID,
    source: resolved.source,
  };
}
