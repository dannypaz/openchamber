import React from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChatErrorBoundary } from '@/components/chat/ChatErrorBoundary';
import { useSessionUIStore } from '@/sync/session-ui-store';
import { useGlobalSessionsStore } from '@/stores/useGlobalSessionsStore';
import { getCloudTargetId } from '@/lib/sessionCloudMetadata';
import { SyncContext } from '@/sync/sync-context';
import { getCloudSyncSystem } from '@/sync/cloud-pipeline-registry';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icon/Icon';

type ChatViewProps = {
    readOnly?: boolean;
};

const CloudSessionUnavailable: React.FC = () => {
    const { t } = useI18n();
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <Icon name="cloud-off" className="size-8" />
            <p className="text-sm font-medium text-foreground">{t('chat.cloudSession.unavailable.title')}</p>
            <p className="max-w-sm text-sm">{t('chat.cloudSession.unavailable.description')}</p>
        </div>
    );
};

export const ChatView: React.FC<ChatViewProps> = ({ readOnly = false }) => {
    const currentSessionId = useSessionUIStore((state) => state.currentSessionId);
    const currentSession = useGlobalSessionsStore((state) =>
        currentSessionId
            ? state.activeSessions.find((s) => s.id === currentSessionId)
                ?? state.archivedSessions.find((s) => s.id === currentSessionId)
                ?? null
            : null
    );
    const cloudTargetId = getCloudTargetId(currentSession);

    const content = (
        <ChatErrorBoundary sessionId={currentSessionId || undefined}>
            <ChatContainer readOnly={readOnly} />
        </ChatErrorBoundary>
    );

    if (cloudTargetId) {
        // Cloud sessions read/write through their own pipeline's SyncSystem
        // (independent childStores + SDK client bound to x-opencode-target),
        // never the default backend. Nesting the provider here scopes every
        // useSyncSystem()-derived hook under ChatContainer to that pipeline
        // without touching those hooks — see cloud-pipeline-registry.ts.
        const cloudSyncSystem = getCloudSyncSystem(cloudTargetId);
        if (!cloudSyncSystem) {
            return <CloudSessionUnavailable />;
        }
        return (
            <SyncContext.Provider value={cloudSyncSystem}>
                {content}
            </SyncContext.Provider>
        );
    }

    return content;
};
