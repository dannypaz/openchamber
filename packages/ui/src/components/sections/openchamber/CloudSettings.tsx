import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/icon/Icon';
import { toast } from '@/components/ui';
import { runtimeFetch } from '@/lib/runtime-fetch';
import { updateDesktopSettings } from '@/lib/persistence';
import { useI18n } from '@/lib/i18n';
import type { DesktopSettings } from '@/lib/desktop';

const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
const DEFAULT_MAX_LIFETIME_MINUTES = 480;

export const CloudSettings: React.FC = () => {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [enabled, setEnabled] = React.useState(false);
  const [provisionWebhookUrl, setProvisionWebhookUrl] = React.useState('');
  const [destroyWebhookUrl, setDestroyWebhookUrl] = React.useState('');
  // Never populated from a read — the server redacts the stored token and
  // only reports whether one is set (hasCloudProvisioningWebhookAuthToken).
  // Left blank on save means "leave the stored token untouched," not "clear it."
  const [webhookAuthTokenInput, setWebhookAuthTokenInput] = React.useState('');
  const [hasWebhookAuthToken, setHasWebhookAuthToken] = React.useState(false);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = React.useState<number | undefined>(DEFAULT_IDLE_TIMEOUT_MINUTES);
  const [maxLifetimeMinutes, setMaxLifetimeMinutes] = React.useState<number | undefined>(DEFAULT_MAX_LIFETIME_MINUTES);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await runtimeFetch('/api/config/settings', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json().catch(() => null)) as (DesktopSettings & {
          hasCloudProvisioningWebhookAuthToken?: boolean;
        }) | null;
        if (cancelled || !data) {
          return;
        }
        const cloud = data.cloudProvisioning;
        if (cloud) {
          if (typeof cloud.enabled === 'boolean') setEnabled(cloud.enabled);
          if (typeof cloud.provisionWebhookUrl === 'string') setProvisionWebhookUrl(cloud.provisionWebhookUrl);
          if (typeof cloud.destroyWebhookUrl === 'string') setDestroyWebhookUrl(cloud.destroyWebhookUrl);
          if (typeof cloud.idleTimeoutMinutes === 'number') setIdleTimeoutMinutes(cloud.idleTimeoutMinutes);
          if (typeof cloud.maxLifetimeMinutes === 'number') setMaxLifetimeMinutes(cloud.maxLifetimeMinutes);
        }
        setHasWebhookAuthToken(Boolean(data.hasCloudProvisioningWebhookAuthToken));
      } catch {
        // ignore — settings simply stay at their defaults
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnabledChange = React.useCallback((next: boolean) => {
    setEnabled(next);
    void updateDesktopSettings({ cloudProvisioning: { enabled: next } });
  }, []);

  const handleSave = React.useCallback(async () => {
    setIsSaving(true);
    try {
      const trimmedToken = webhookAuthTokenInput.trim();
      await updateDesktopSettings({
        cloudProvisioning: {
          enabled,
          provisionWebhookUrl: provisionWebhookUrl.trim(),
          destroyWebhookUrl: destroyWebhookUrl.trim(),
          idleTimeoutMinutes,
          maxLifetimeMinutes,
          // Omit entirely when blank so the server's deep-merge leaves any
          // previously-stored token untouched — an empty string here would
          // instead be treated as "set the token to empty."
          ...(trimmedToken ? { webhookAuthToken: trimmedToken } : {}),
        },
      });
      if (trimmedToken) {
        setHasWebhookAuthToken(true);
        setWebhookAuthTokenInput('');
      }
      toast.success(t('settings.openchamber.cloud.toast.saved'));
    } catch {
      toast.error(t('settings.openchamber.cloud.toast.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [destroyWebhookUrl, enabled, idleTimeoutMinutes, maxLifetimeMinutes, provisionWebhookUrl, t, webhookAuthTokenInput]);

  const handleClearToken = React.useCallback(async () => {
    setIsSaving(true);
    try {
      await updateDesktopSettings({ cloudProvisioning: { webhookAuthToken: null } });
      setHasWebhookAuthToken(false);
      setWebhookAuthTokenInput('');
      toast.success(t('settings.openchamber.cloud.toast.tokenCleared'));
    } catch {
      toast.error(t('settings.openchamber.cloud.toast.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [t]);

  return (
    <div className="mb-8">
      <div className="mb-1 px-1">
        <div className="flex items-center gap-2">
          <h3 className="typography-ui-header font-medium text-foreground">
            {t('settings.openchamber.cloud.title')}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Icon name="information" className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent sideOffset={8} className="max-w-xs">
              {t('settings.openchamber.cloud.tooltip')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <section className="px-2 pb-2 pt-0 space-y-0.5">
        <label data-settings-item="cloud.enabled" className="flex cursor-pointer items-center gap-2 py-1.5">
          <Checkbox
            checked={enabled}
            onChange={handleEnabledChange}
            ariaLabel={t('settings.openchamber.cloud.field.enabledAria')}
          />
          <span className="typography-ui-label text-foreground">
            {t('settings.openchamber.cloud.field.enabled')}
          </span>
        </label>

        {enabled && (
          <>
            <div data-settings-item="cloud.provisionWebhookUrl" className="flex flex-col gap-2 py-1.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-col shrink-0 sm:w-56">
                <span className="typography-ui-label text-foreground">{t('settings.openchamber.cloud.field.provisionWebhookUrl')}</span>
              </div>
              <Input
                value={provisionWebhookUrl}
                onChange={(e) => setProvisionWebhookUrl(e.target.value)}
                placeholder={t('settings.openchamber.cloud.field.provisionWebhookUrlPlaceholder')}
                disabled={isLoading || isSaving}
                className="h-7 min-w-0 flex-1 font-mono text-xs sm:max-w-md"
              />
            </div>

            <div data-settings-item="cloud.destroyWebhookUrl" className="flex flex-col gap-2 py-1.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-col shrink-0 sm:w-56">
                <span className="typography-ui-label text-foreground">{t('settings.openchamber.cloud.field.destroyWebhookUrl')}</span>
              </div>
              <Input
                value={destroyWebhookUrl}
                onChange={(e) => setDestroyWebhookUrl(e.target.value)}
                placeholder={t('settings.openchamber.cloud.field.destroyWebhookUrlPlaceholder')}
                disabled={isLoading || isSaving}
                className="h-7 min-w-0 flex-1 font-mono text-xs sm:max-w-md"
              />
            </div>

            <div data-settings-item="cloud.webhookAuthToken" className="flex flex-col gap-2 py-1.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-col shrink-0 sm:w-56">
                <span className="typography-ui-label text-foreground">{t('settings.openchamber.cloud.field.webhookAuthToken')}</span>
              </div>
              <div className="flex min-w-0 items-center gap-2 sm:max-w-md sm:flex-1">
                <Input
                  type="password"
                  value={webhookAuthTokenInput}
                  onChange={(e) => setWebhookAuthTokenInput(e.target.value)}
                  placeholder={hasWebhookAuthToken
                    ? t('settings.openchamber.cloud.field.webhookAuthTokenSetPlaceholder')
                    : t('settings.openchamber.cloud.field.webhookAuthTokenPlaceholder')}
                  disabled={isLoading || isSaving}
                  className="h-7 min-w-0 flex-1 font-mono text-xs"
                />
                {hasWebhookAuthToken && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleClearToken}
                    disabled={isLoading || isSaving}
                    className="h-7 shrink-0 !font-normal"
                  >
                    {t('settings.openchamber.cloud.actions.clearToken')}
                  </Button>
                )}
              </div>
            </div>

            <div data-settings-item="cloud.idleTimeoutMinutes" className="flex items-center gap-8 py-1.5">
              <span className="w-56 shrink-0 typography-ui-label text-foreground">{t('settings.openchamber.cloud.field.idleTimeoutMinutes')}</span>
              <NumberInput
                value={idleTimeoutMinutes}
                fallbackValue={DEFAULT_IDLE_TIMEOUT_MINUTES}
                onValueChange={setIdleTimeoutMinutes}
                onClear={() => setIdleTimeoutMinutes(undefined)}
                min={1}
                max={7 * 24 * 60}
                step={5}
                inputMode="numeric"
                disabled={isLoading || isSaving}
                className="h-7 w-24"
              />
            </div>

            <div data-settings-item="cloud.maxLifetimeMinutes" className="flex items-center gap-8 py-1.5">
              <span className="w-56 shrink-0 typography-ui-label text-foreground">{t('settings.openchamber.cloud.field.maxLifetimeMinutes')}</span>
              <NumberInput
                value={maxLifetimeMinutes}
                fallbackValue={DEFAULT_MAX_LIFETIME_MINUTES}
                onValueChange={setMaxLifetimeMinutes}
                onClear={() => setMaxLifetimeMinutes(undefined)}
                min={1}
                max={7 * 24 * 60}
                step={30}
                inputMode="numeric"
                disabled={isLoading || isSaving}
                className="h-7 w-24"
              />
            </div>

            <div className="flex justify-start py-1.5">
              <Button
                type="button"
                size="xs"
                onClick={handleSave}
                disabled={isLoading || isSaving}
                className="shrink-0 !font-normal"
              >
                {isSaving ? t('settings.common.actions.saving') : t('settings.openchamber.cloud.actions.save')}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
