import type { Session } from '@opencode-ai/sdk/v2';
import { getSessionMetadata, type SessionMetadataRecord } from './sessionReviewMetadata';

// Mirrors sessionReviewMetadata.ts's openchamber-namespaced metadata
// convention, scoped to cloud-target association instead of review links.
// Persisted in the session's own metadata (not just held client-side) so
// reopening a cloud session after a reload still knows which ephemeral
// target it belongs to.

type OpenChamberCloudMetadata = {
  cloudTargetId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const getOpenChamberCloudMetadata = (metadata: SessionMetadataRecord): OpenChamberCloudMetadata => {
  const value = metadata.openchamber;
  return isRecord(value) ? (value as OpenChamberCloudMetadata) : {};
};

export const getCloudTargetId = (session: Session | null | undefined): string | null => {
  const value = getOpenChamberCloudMetadata(getSessionMetadata(session)).cloudTargetId;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const isCloudSession = (session: Session | null | undefined): boolean =>
  getCloudTargetId(session) !== null;

export const withCloudTargetId = (
  metadata: SessionMetadataRecord,
  cloudTargetId: string,
): SessionMetadataRecord => {
  const current = getOpenChamberCloudMetadata(metadata);
  return {
    ...metadata,
    openchamber: {
      ...current,
      cloudTargetId,
    },
  };
};
