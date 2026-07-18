import * as React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/icon/Icon';
import { DesktopHostSwitcherDialog } from '@/components/desktop/DesktopHostSwitcher';
import { useDesktopInstanceLabel } from '@/hooks/useDesktopInstanceLabel';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface InstanceSwitcherProps {
    className?: string;
}

/**
 * Standalone rendering of the desktop instance ("Local" vs. saved remote
 * host) switcher, styled to sit next to the draft project/branch selectors.
 * Electron-only, mirrored from ModelControls' footer instance switcher —
 * see useDesktopInstanceLabel for why isDesktopApp gates rendering.
 */
export const InstanceSwitcher: React.FC<InstanceSwitcherProps> = ({ className }) => {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = React.useState(false);
    const { isDesktopApp, currentInstanceLabel, compactCurrentInstanceLabel, refreshCurrentInstanceLabel } = useDesktopInstanceLabel();

    if (!isDesktopApp) {
        return null;
    }

    return (
        <Tooltip delayDuration={600}>
            <DropdownMenu
                open={isOpen}
                onOpenChange={(open) => {
                    setIsOpen(open);
                    if (open) {
                        void refreshCurrentInstanceLabel();
                    }
                }}
            >
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                'inline-flex h-7 min-w-0 w-fit max-w-[42vw] sm:max-w-[14rem] flex-shrink-0 cursor-pointer items-center gap-1 rounded-lg px-1.5 typography-micro font-medium text-foreground/80 hover:bg-[var(--interactive-hover)]',
                                className,
                            )}
                            aria-label={t('chat.modelControls.instanceSwitcher.openAria', { current: currentInstanceLabel })}
                        >
                            <Icon name="stack" className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate">{compactCurrentInstanceLabel}</span>
                        </button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    portalToBody
                    className="w-[min(22rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto bg-[var(--surface-elevated)] p-0"
                >
                    <DesktopHostSwitcherDialog
                        embedded
                        open={isOpen}
                        onOpenChange={() => {}}
                        onHostSwitched={() => setIsOpen(false)}
                    />
                </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent side="top">
                <p className="typography-meta">{t('chat.modelControls.instanceSwitcher.tooltip', { current: currentInstanceLabel })}</p>
            </TooltipContent>
        </Tooltip>
    );
};
