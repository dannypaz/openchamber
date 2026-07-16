import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/icon/Icon';
import { useI18n } from '@/lib/i18n';
import type { GitHubAuthStatus } from '@/lib/api/types';

type SidebarGitHubAccountMenuProps = {
  githubAuthStatus: GitHubAuthStatus | null;
  githubAccounts: Array<NonNullable<GitHubAuthStatus['accounts']>[number]>;
  githubAvatarUrl: string | null;
  githubLogin: string | null;
  isSwitchingGitHubAccount: boolean;
  onSwitchAccount: (accountId: string) => Promise<void>;
};

const avatarButtonClassName = 'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/80 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export function SidebarGitHubAccountMenu({
  githubAuthStatus,
  githubAccounts,
  githubAvatarUrl,
  githubLogin,
  isSwitchingGitHubAccount,
  onSwitchAccount,
}: SidebarGitHubAccountMenuProps): React.ReactNode {
  const { t } = useI18n();

  if (!githubAuthStatus?.connected) {
    return null;
  }

  const avatarImage = githubAvatarUrl ? (
    <img
      src={githubAvatarUrl}
      alt={githubLogin ? t('sessions.sidebar.footer.github.avatarWithLogin', { login: githubLogin }) : t('sessions.sidebar.footer.github.avatar')}
      className="h-full w-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <Icon name="github-fill" className="h-3.5 w-3.5 text-foreground" />
  );

  const title = githubLogin
    ? t('sessions.sidebar.footer.github.connectedWithLogin', { login: githubLogin })
    : t('sessions.sidebar.footer.github.connected');

  if (githubAccounts.length > 1) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={avatarButtonClassName}
            title={title}
            aria-label={title}
            disabled={isSwitchingGitHubAccount}
          >
            {avatarImage}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-64">
          <DropdownMenuLabel className="typography-ui-header font-semibold text-foreground">
            {t('sessions.sidebar.footer.github.accountsTitle')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {githubAccounts.map((account) => {
            const accountUser = account.user;
            const isCurrent = Boolean(account.current);
            const sourceLabel = account.source === 'gh-cli'
              ? t('sessions.sidebar.footer.github.accountSource.cli')
              : t('sessions.sidebar.footer.github.accountSource.oauth');
            return (
              <DropdownMenuItem
                key={account.id}
                className="gap-2"
                disabled={isSwitchingGitHubAccount}
                onSelect={() => {
                  if (!isCurrent) {
                    void onSwitchAccount(account.id);
                  }
                }}
              >
                {accountUser?.avatarUrl ? (
                  <img
                    src={accountUser.avatarUrl}
                    alt={accountUser.login ? t('sessions.sidebar.footer.github.avatarWithLogin', { login: accountUser.login }) : t('sessions.sidebar.footer.github.avatar')}
                    className="h-6 w-6 rounded-full border border-border/60 bg-muted object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-muted">
                    <Icon name="github-fill" className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate typography-ui-label text-foreground">
                    {accountUser?.name?.trim() || accountUser?.login || 'GitHub'}
                  </span>
                  {accountUser?.login ? (
                    <span className="truncate typography-micro text-muted-foreground">
                      <span className="font-mono">{accountUser.login}</span>
                      <span className="mx-1 opacity-50">·</span>
                      <span>{sourceLabel}</span>
                    </span>
                  ) : null}
                </span>
                {isCurrent ? <Icon name="check" className="h-4 w-4 text-primary" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={avatarButtonClassName} title={title} aria-label={title}>
          {avatarImage}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}><p>{title}</p></TooltipContent>
    </Tooltip>
  );
}
