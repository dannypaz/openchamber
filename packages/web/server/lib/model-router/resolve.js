import { parseModelRef } from '../small-model/resolve.js';

/**
 * Pure per-tier precedence pick: an explicit override always wins, otherwise
 * the tier's fallback model applies. No I/O — both overrides and fallbacks
 * are resolved by the caller (settings read, classifier result, or the
 * client's own default-model resolution).
 */
export function resolveTierModel({ tier, cheapOverrideRef, frontierOverrideRef, cheapFallback, frontierFallback }) {
  if (tier === 'simple') {
    const override = parseModelRef(cheapOverrideRef);
    if (override) {
      return { providerID: override.providerID, modelID: override.modelID, source: 'override' };
    }
    if (cheapFallback?.providerID && cheapFallback?.modelID) {
      return { providerID: cheapFallback.providerID, modelID: cheapFallback.modelID, source: 'fallback' };
    }
    return null;
  }

  const override = parseModelRef(frontierOverrideRef);
  if (override) {
    return { providerID: override.providerID, modelID: override.modelID, source: 'override' };
  }
  if (frontierFallback?.providerID && frontierFallback?.modelID) {
    return { providerID: frontierFallback.providerID, modelID: frontierFallback.modelID, source: 'fallback' };
  }
  return null;
}
