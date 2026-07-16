# Model Router (Auto Router)

Resolves the client's "Auto" model sentinel to a concrete `{providerID,
modelID}` pair for one message, entirely server-side. OpenCode has no
per-request routing concept — it just executes whatever model it is given —
so this is purely an OpenChamber-side classify-then-pick step that runs
*before* the existing chat-send path, which never changes shape.

v1 scope: two tiers (cheap / frontier), stateless per-message classification
(no session memory), and "Auto" is selectable only as a session's current
model — not wired into project/settings default-model resolution.

## Files

- `classify.js` — `classifyMessageTier()`: calls the Small Model resolver
  (`../small-model/index.js`'s `generateSmallModelText`) with a fixed
  SIMPLE/COMPLEX classification prompt, wrapped in an external ~2.5s timeout
  (the small model's own internal call timeout is 60s and not parameterized,
  so this layer enforces the router's own budget). The resolved
  provider/model that ran the classification doubles as the cheap-tier
  candidate — no second resolution. Never throws: timeout, small-model
  resolution failure, and unparseable output all return `null`, which the
  caller treats as "classification unavailable" and must fail toward the
  frontier tier, never toward cheap.
- `resolve.js` — `resolveTierModel()`: pure per-tier precedence pick
  (explicit override via `parseModelRef` from `../small-model/resolve.js`,
  otherwise the tier's fallback). No I/O.
- `index.js` — `resolveAutoModel()`: reads Auto Router's own settings
  overrides (`modelRouterCheapOverride` / `modelRouterFrontierOverride` in
  `settings.json`, same precedence-by-presence pattern as
  `smallModelOverride`), classifies the message, and resolves each tier.
  `frontierFallback` comes from the client's own already-resolved default
  model (`defaultAgentModel` in the request body) — that cascade
  (project/settings default, agent-pinned model, variant resolution) lives
  entirely client-side in `useConfigStore.ts`'s
  `resolveDefaultAgentModelSelection`, so the server does not duplicate it.
  Returns `{ available: false }` when nothing could be resolved at all; the
  client falls back to its own default-model resolution in that case.
- `routes.js` — `POST /api/openchamber/model-router/resolve`
  (`{ text, directory?, preferredProviderID?, preferredModelID?,
  defaultAgentModel? }` → `{ available, tier?, providerID?, modelID?,
  source? }`).

## Registration

Mounted lazily from `feature-routes-runtime.js` (same pattern as
`small-model`/quota): the module is imported on first request, not at
server startup.

## Client integration

`packages/ui/src/stores/useConfigStore.ts` defines the sentinel
(`AUTO_ROUTER_PROVIDER_ID` / `AUTO_ROUTER_MODEL_ID` = `"__auto__"`) and
bypasses the provider-existence gates that would otherwise silently evict it
on the next provider-list refresh. `packages/ui/src/components/chat/
ChatInput.tsx` intercepts the sentinel right before the existing send call
and resolves it via one round-trip to this module's route, covering both
live and queued sends.
