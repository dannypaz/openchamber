# Danny List

Feature log tracking what shipped in each merged PR.

## PR #2 — feat: add Auto Router model mode with configurable cheap/frontier tiers

- Cost-aware "Auto" entry in the model picker (mirrors Cursor's Auto mode): routes simple asks to a cheap model and hard asks to a stronger/frontier model, without manually swapping models.
- New `packages/web/server/lib/model-router/` module; reuses the existing Small Model resolver as both the SIMPLE/COMPLEX classifier and the default cheap-tier model.
- New `POST /api/openchamber/model-router/resolve` route: classifies one message and returns the resolved `{providerID, modelID}`, wrapped in an external ~2.5s timeout. Classification failure/timeout always fails open to the frontier tier, never to cheap.
- `AUTO_ROUTER_PROVIDER_ID` / `AUTO_ROUTER_MODEL_ID` sentinel (`"__auto__"`) added to `useConfigStore.ts`.
- Fixed a persistence bug where `resolveProviderModelSelection`'s `hasProviderModel` gate would silently evict the Auto selection on the next provider-list refresh; same bypass added to `setProvider` and `ModelControls.tsx`'s `tryApplyModelSelection`.
- Opt-in pinned "Auto" row added to `ModelPickerList.tsx` (chat picker only — settings pickers for default/small models don't offer it).
- `ChatInput.tsx` resolves the Auto sentinel via one round-trip to the new route right before the existing send path runs, covering both live sends and messages queued while Auto was selected.
- New settings: `modelRouterCheapOverride` / `modelRouterFrontierOverride` under Session Defaults → Auto Router, mirroring the existing Small Model override fields (desktop settings, server sanitizer, VS Code bridge, settings search registry), localized across all supported locales.

## PR #1 — feat: GitHub device-code UX, Linux polish, and draft starters toggle

- GitHub device flow: copy-to-clipboard button for the device code.
- GitHub device flow: pre-fill the code in the browser via `?user_code=` on the verification URL.
- Usage settings: hide providers with no usage/quota data instead of listing every known provider.
- Linux: fixed titlebar/sidebar width overlap (measured live via CDP).
- Linux: swapped the Finder icon/label for Files (Nautilus) in "Open in App".
- Added a "Show Draft Starters" setting to hide the starter-prompt chips on the new-chat screen, synced via `settings.json`.
- Swapped the Auto-discover project action icon from search to radar so it isn't confused with session search.
- Documented the `zlib1g-dev` requirement for AppImage extraction/verify.
