import React from 'react';
import { Icon } from "@/components/icon/Icon";

interface ToolStatusBadgeProps {
    isRunning: boolean;
    isSuccess: boolean;
}

// Small corner badge layered over a tool's per-type icon (pencil, terminal, etc.)
// so status is visible without losing which tool ran. Silent (no badge) while
// pending/queued and on error, since the icon's existing red tint already
// communicates failure.
export const ToolStatusBadge: React.FC<ToolStatusBadgeProps> = ({ isRunning, isSuccess }) => {
    if (!isRunning && !isSuccess) {
        return null;
    }

    return (
        <span
            aria-hidden="true"
            className="absolute -bottom-px -right-px flex size-2 items-center justify-center rounded-full bg-[var(--surface-background)]"
        >
            {isRunning ? (
                <Icon name="loader-4" className="size-1.5 animate-spin text-muted-foreground" />
            ) : (
                <Icon name="checkbox-circle" className="size-2 text-[var(--status-success)]" />
            )}
        </span>
    );
};
