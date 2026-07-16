/**
 * Registry of live event pipelines for cloud-target-routed OpenCode backends
 * (ephemeral per-session VMs), running alongside — never replacing — the
 * app's one default-backend pipeline owned by <SyncProvider> in
 * sync-context.tsx.
 *
 * Why a separate registry instead of mounting a second <SyncProvider>: a
 * cloud session's sidebar presence (status badges, completion notifications)
 * must keep updating even while its chat isn't the currently-rendered view,
 * exactly like local sessions already do. A pipeline tied to a component's
 * mount lifecycle would stop tracking the moment the user navigates away —
 * the same regression a single "switchable" pipeline would cause. Each
 * entry here runs independently, keyed by targetId, and feeds events through
 * the SAME handleEvent()/routing-index fan-out sync-context.tsx already uses
 * (exported from there for exactly this reuse) so cross-cutting aggregators
 * (useGlobalSyncStore, notifications) see cloud sessions like any other.
 *
 * The view layer (a cloud session's open chat) reads this registry's
 * childStores by nesting <SyncContext.Provider value={entry}> around just
 * that subtree — see useCloudSyncSystem() below.
 */

import type { Event, Session } from "@opencode-ai/sdk/v2/client"
import { opencodeClient } from "@/lib/opencode/client"
import { createEventPipeline, type EventPipeline } from "./event-pipeline"
import { ChildStoreManager } from "./child-store"
import {
  createEventRoutingIndex,
  handleEvent,
  resolveDirectoryFromRoutingIndex,
  type EventRoutingIndex,
  type SyncSystem,
} from "./sync-context"

type CloudPipelineEntry = {
  targetId: string
  directory: string
  childStores: ChildStoreManager
  routingIndex: EventRoutingIndex
  pipeline: EventPipeline
  syncSystem: SyncSystem
}

const registry = new Map<string, CloudPipelineEntry>()

/**
 * Starts a live event pipeline for a cloud target, seeded with the session
 * that was just created against it. No-op if already running for this
 * targetId (idempotent, matching the server-side registry's semantics).
 *
 * Deliberately skips the local-directory bootstrap flow (VCS status,
 * project metadata, icon discovery) that the default pipeline runs —
 * those are local-filesystem concepts that don't apply to a remote VM's
 * checkout, and a freshly-created cloud session has no prior history to
 * catch up on, so the store starts "complete" with just the new session
 * and fills in via live events from here.
 */
export const startCloudTargetPipeline = (
  targetId: string,
  directory: string,
  initialSession: Session,
): SyncSystem => {
  const existing = registry.get(targetId)
  if (existing) {
    return existing.syncSystem
  }

  const childStores = new ChildStoreManager()
  const routingIndex = createEventRoutingIndex()
  childStores.ensureChild(directory, { bootstrap: false })
  childStores.update(directory, () => ({
    status: "complete",
    session: [initialSession],
    sessionTotal: 1,
  }))

  const sdk = opencodeClient.getEphemeralTargetSdkClient(targetId, directory)

  const pipeline = createEventPipeline({
    sdk,
    onEvent: (eventDirectory: string, payload: Event) => {
      handleEvent(eventDirectory, payload, childStores, routingIndex)
    },
    routeDirectory: (eventDirectory: string, payload: Event) =>
      resolveDirectoryFromRoutingIndex(routingIndex, eventDirectory, payload, childStores),
  })

  const syncSystem: SyncSystem = { childStores, sdk, directory }
  registry.set(targetId, { targetId, directory, childStores, routingIndex, pipeline, syncSystem })
  return syncSystem
}

/** Stops and removes a cloud target's pipeline. Idempotent. */
export const stopCloudTargetPipeline = (targetId: string): void => {
  const entry = registry.get(targetId)
  if (!entry) return
  entry.pipeline.cleanup()
  entry.childStores.disposeAll()
  registry.delete(targetId)
}

/** Read accessor for the sync system backing a running cloud target, or null. */
export const getCloudSyncSystem = (targetId: string): SyncSystem | null => {
  return registry.get(targetId)?.syncSystem ?? null
}

export const isCloudTargetPipelineRunning = (targetId: string): boolean => registry.has(targetId)

/** Best-effort teardown of every running cloud pipeline (e.g. on app unload). */
export const stopAllCloudTargetPipelines = (): void => {
  for (const targetId of Array.from(registry.keys())) {
    stopCloudTargetPipeline(targetId)
  }
}
