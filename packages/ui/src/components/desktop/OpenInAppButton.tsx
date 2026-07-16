import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui';
import { Icon } from "@/components/icon/Icon";
import { copyTextToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { isDesktopLocalOriginActive, isDesktopShell, openDesktopPath, openDesktopProjectInApp } from '@/lib/desktop';
import { DEFAULT_OPEN_IN_APP_ID, OPEN_IN_APPS } from '@/lib/openInApps';
import { useOpenInAppsStore, type OpenInAppOption } from '@/stores/useOpenInAppsStore';
import { useI18n } from '@/lib/i18n';

const FINDER_DEFAULT_ICON_DATA_URL = 'data:image/png;base64,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';
const TERMINAL_DEFAULT_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAeGVYSWZNTQAqAAAACAAEARoABQAAAAEAAAA+ARsABQAAAAEAAABGASgAAwAAAAEAAgAAh2kABAAAAAEAAABOAAAAAAAAAJAAAAABAAAAkAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAAB+C9pSAAAACXBIWXMAABYlAAAWJQFJUiTwAAABnWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyI+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj4yNTY8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MjU2PC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cl6wHhsAAAQzSURBVFgJ7VZNbBNHFH67Xv9RxwnBDqlUoQglcZK6qSIEJIQWAYJQoVY9IE5RTzn20FMvqdpDesq9B24+NdwthAJCkZChJg1JSOXYQIwQKQIaBdtENbs73t2+N8miGWOcpFHUHniyd97OvJ9v3nv7ZgDe038cAeVd/jOZjC94sKdfU+Bj24G9igpexwYPyiu2bauKqqqirkOTqmrjnIOyFsoyUKDocSCj/7mU7ujoMER5l68JYOFZ4YSiwPjd9O0jjx7ch1KhAJZVAcdx0LxDv3XetYKjggr4I4bzHo8G4aYmONjZBYf6+2dUzfd9PNowJajUZmef/PX5zcWl0rmvvnbQHrra+f/M+S+dqYXs2t3Hz09Ve5UicCmZ3NPb1Zv66btv+65dSULA64WGxkbw+Xx8V9XK9d4pWowxeFUqgW6acHroC/j5l0sLD/PZY98MDf3t6mouQ+On3X1H7/2e7rtOztHpgbY2+CAUgperq+D3+7cNgtLSEA7D0+VluDF5FS7cSff2HT56DF1dd/3KhQTWJ/lclsc8jIrk9IfRURgZGQEvRqNSWa8D2t1W/liXXK8Ro0i0lF0ExaPEXec0SgAqhrm3VCzwdS9GQNd1GBsbg0AgAIlEAlpbW7EYLVF/U56AagieiGwbuhERlSQApmEE8c/XKXxU0fF4HNowFfPz81Aul7edBjLGbeHITANsZga4g42HVAM2Y74KM/kSIQ/izgcHB2FiYgJmZmZ4MZpYULRG5PF4+Bx/2cLDxuhhYUqFLwGoWCaQEBGhNjAa4+Pj/J3SQA6pHpqbm/kcNitIJpOgaZIZvlbrQbZNJvcjSZOZDKhwRKLic4l2Pjc3B8FgkE+trKxAVUN0RWuOZNtCHyJJACj/bgREIZcnA9PT029SQM63unuywSOwUWOuTQmAhfmnlluPxIjUk6u1RrbJh0jyV0Ap2OZnJhrbjOcRqEqBBMDCAtltAORDJAkAVj2mWS5CUXinPDUx+oxFkgBYjO0qANu2wKoqQgkAfgW7C4AiYMmfoQSgwpjj7GYRUh/Q66SAmdisNxql227FfP1bXrRlVExdtCNHwDRLdPkgwmi8OUREhe3y1NLJFpEfbWMNvBRtSI2o+KqYi+zbx4NQwptMCO8E1HjEHYjKm/HknG5FZIsCG4lEoLS2lhP1JAB3bt1KH//s+GJPd3dPJpvlN5kwXiYIhHukisr1eAItXsm6YzGItrTcn5+dvS3qSQBSqVQhFouNnj039CsaCC7mcqDjgbNT6op1AtrU8Wo3Ojk5KaVAOptdR8PDwxf3t7SMvXjxvJNOPP31a35Krt8CXKl3j2SUDip/IAjRaBRaP9z/cHW18GMikbhcrVUTAAm1t7d/NDAwcDIUCvVqmtqkyLe3ajtvvTtg4x3SLpbLa3+kUr9N5fP55beE3k/8HyLwDx2/HIx7q3WfAAAAAElFTkSuQmCC';
// Ubuntu Yaru theme's "Files" (Nautilus) app icon, extracted from the
// yaru-theme-icon package (org.gnome.Nautilus, 48x48@2x).
const FILES_DEFAULT_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAMSElEQVR42uzYA3Qcax8G8HvjVKsitm2rip2NbV+btW3btm3b3N0YB5/9Pfeft+6Zqd2dc351MzPP82rzCYC3SEkZgrIAZQFKygKUBSi9qwUoKQtQFkCXFjEmjsSX9CJxJIWkkSySSwpJyXMoJjlESiKJD+mqLIDQpUJsSXw3bZUve+toT8gw7bCi1Eqw60sbwckfHIQ3f3MUNf/uJGrp5yT+cz9n8d8Guoj/PchVgnsG8xhy12AXyf/6O4v//JuTqO47e8GlQvNOG60Faj/TPUOJ9kdbAF0Skhaq127St/aCy0PdOv9vZqABVoVZYGuMDfZLnXAq0x0X87xxOd8X14v8caskAPLyYNRVhjyTeqIoC8at4gBcyvXC8TRXrI+wwCjPLv/Nt+i0Xl2VzSijj64AuroI1FXKv7QRnpnkq4N9UkfIyoJQWxHChwJ9fvXcqBB/zAs2xE80w8zaq31Pz+NOPv0oCqBLTVX1k8yvbYXnl/Q0hpxGaA0FTKAo8YMi1w3yLCfIM+whS7GGTGoBWZI5/UySzCBLNIEswfgRch4K+rcK+j8K+r81KZaoybBDXZEPK6GhKgTbYm0wgJanYB3tkfRc0aT9x1CAS5xh+1lT/XTvhy/PdcVtCupWvBFuxxvzobC5yZ9AwaE22wkNd0s4leGGsV5d/19s0WmbiGYlPV8QMSECoklUP7QCUn9yENUeTXO9E36OKwuevKkCmNo0azRUBLES5KUBWNHbBLR5/72cDgAxBh2mOgg1fqeDwRdCdZVqdpp6c3IfknZXHAkjfsSWdCUqz10AXSLbThq/jvLsCkXbslNOG2SCySMFkOcsgDx/AUyN1Az1RV6sBML2hh1xNlhKS+M0mqFj6TlHeXTBUFfJ07nxG8ZjOAcaBH+7Z4CLuJVOfk2/OIpufG8vPEODY3uKccf5nhKt/rSMF1CePYnB8xRgHWvQfsGCHkZQUPiKQm8W+FsrIPGOWtob6kt87hfR+AKaqvk1V3fn1MKhtizwvltFfrhZ6IOL2R44keaC3TQ41oSaYjoNDjpi//Uz60773MVa/SjXGCJ6lgK8C8w67t0UZUUFBEGW5cRTwBtZhij8R9WmWKAu2xH1Be5oKPFFQ5k/GssD0VgZ8kyaqrg1Pz8qg18rURT7YVesDSbQ/tVWREd11RI2G55SQO8Kq06ndyfYQUENy9JtWeBvdxZwq30BdUnc6pNMeDU8TmrGNKaYozHVAk1plmjKtEVTjiOa813RXOSJ1vIAtFYFM/WU4yrav+gD603BnUOE+EkFJH1tJ7xxOMWJFXA71fpjKIDhL4Bfo5RbE2lOt0ZLWxmVwcxKKuELW8ERyjiRfMpXQO7PDqLms1nuUNDJ45bUnIX91pehtz8L+AvgL4FpznGkAoJoJgRgsk83+HTWHEo5m/EVUNbHUfznK/lekJf642aiKQv7hWeBsgCmpdADVALbpOm7Cycp5wi+Air7Oon/dq2ACiihHf6xI+hNci7aAIfD9bG7tx629tDDhu66WB2swywPvCtIB0sCu3Fa+gKW8Vj+AlYEPYkOp5UPWRv8wEZ69009dLG9lx72hOqxXM5EGeJ6nNHDJbDlqLWCTk5FPqAj8T+1VdhnFw2uAj7r7yz6580Cb8iLfVkBFDpORxlga09dClAHM0NtMC7RH8MyI9C/IBW/l+Tgp8pi/FhViu8+r77v66+//iCx9/vijp/onX+pLEGf0hwMLEzFqKxITJYGYH6ELdaG6GJ/qD6uxhqhKdkUrWV+bHOe4a8Lb4nmWMpan6uAL6iAf98pwAfn6T+v794WujWGZMfSzavQp08fjB49GtOnT8eCBQuwfPlyrF69GmvXrsWGDRuwceNGZuvWre+FLVu2PI/777d+/XqsWbOGvfuyZctYFpQJy4YyYlkNz4mlMmywk2aIPNeVCvDH2lATpJl0WENZO3MV8DUV8L/bhT44l+2BRcH6GEzB//TjD5gyZQq7Gd1ciQMNvkesWrWKZfZHe+cc5siTx+Hz/Wzbxtq2OUgG0docr23btm3btm1bdfU+z/ScOst0di73/eOz7HRNvW+rqlNVsGvrKK4mF/pO7dP31oVFv1Plvnl1IX1aZgLq6hcqaocjjRpd7DfVoLxDtW3bNukIJ/x59OjRasSIEWro0KFq0KBBqn///qpfv34cAUnp3bt3QOZf60idqTsMYDF8+HDYAD+J1/jx41WbNm1U06pl1OSSKdRSfSOu8cMbGzTrwmYCohAwtfgvqm2lSOCzA6JGjhxJYY/5g0pgBTODX4cOHVTHyg41scA3Ku7nN/bSiedVwMCgTKpJkyZq1KhRXN8wLFCfMrDjrCAwHRKUUTXWHXiatcergDbaFB/mMjNkyBAB+YwZPHgwZwN/Vm0qhivdi3qZNpepgKYp31H1Y2P4APB9cD2XwBCWHNAJ0VGqeap3r9HmMhUQn+lr1bRpUy4/asCAAQLQR4ElBzWPqPWzfHOLNpepgDq5U6l27dpxR/fx0S9nAWdAq1atVHSe1Hdpc5kKqF4gs+rcubMIsEAATHkaqlkg0wPaXKYCKhfNpbp160bLTgRYIAC21TRj2lymAsqVLEgLDgGqT58+As9HgSVMYVtRM4a1qQBPcAlaeGws4Hwcg2nZkJLeBbhswTQeRIBFAngactuCvAtw2kPUwIED6dsQaBYI4OB22kK8C3DYbWz0XATw9NWyZUvVrFkzmu2WhDZOixYteBrxe/2MzkunZuxdQLidjfzeBUE/Ou0PunKXLFmiVq9ebUmWLVvGewDK87sEBMDVEWb3LiAiPJy+C78LoIUImAMHDqgzZ86oc+fOWRL2fejQITVnzhzK9GsdYUoiNWPvAiIi2MjvAmJjY9Xy5cvV2bNnAWVlKIOyKPO5CIDxn/70p2hvAjgDiF9/uJiYGH8LoEwRYCQ+Pp7LApcHyy9Bhw8fpizK9He3NEmeAnhC4dXdzJkz1dKlS628CQOfGz5lJksBPAX5/S1Yly5dVOPGjVVcXJzi0hAVFWVJ2DdlcAPu1KmTv9+OkWQpwJDAkcm7aM4GS8K+KYOyKFMEBFx8IICuCCLQREAgxeD6aAH02BGBJgICKgZXESACAj8iQARIRIAIkIgAESARASJAIgJEgEQEiIBkHhEgAurw1UQGGVsjQATAVjMGdm0zAbUd4XYGaFgkQATAli/nehukV9Nhtz1gOI0I8H0Mpg576ANvw1SrO+whDxjHZI0AEQBbhy0YAZXNBFR16v/s2bOnRQJEQI8ePZTLFnxfs65kJqCCK7jkva5du1okQATA1hNckoHa5cwEONzFC91s3749G/twmKrEuK/ytcgyJQpd9zZbSpCzcJ4LzZs3Z2MfDtSWGE+WsPUUyX2OpV/MBBSMzJf1aMOGDY1HJoHnYwENGjRQznxZD3ubMSurLVvardHR0RYJEAGwtWdPt1mzzmIm4Idcv3w9vmLFihZ1R0g3BGxz/vT1aM36O9P1A1594W/xjjAbj6JyI/bxDRimzjD7g5df+FscrM0E/F0nnBsxI0jkMuTbyw9ME2/ANlibCfijTobsP341sozHwwd9IEHg841ofodplu8/H26sCuVtDZm3dMq4C+U6y5gqY9A2O3kyETI/EIMx4MfvsHQXynmK53+dt2HtTcALOt+/+dILCTTKateuzU6YbMgIQtgpUoxJW7nOkf+r6zqQCQxgAZP/ZMW/1a1bV9H4ev3lF7j2/wDjRy3k9o5Oildf/HuUM1/2Yx63iyGdXI6Y//J/MUxCSPxWHqyYGMTjcilHvmxHYQlT2D7OSnp/0flA5zud8NSff9SXnbhCg+6XL1+eYZ7MOMLsJvTuYZ+zAuNJFR03bhwzxgZUqBMzHxJj4g3qDgNjphfYwAhWznzZjqT64uPeMIQlTGH7uGtJ/k3nfZ0PdX7TKaVTHRklMvy+PDJ35oMu/bTk0aeWO6j4XVdI6fuEvm7CWx9evQVUwsOUUT93aOn7xB1U4i4MPIXznI/Mk3l/qQy/L0v1+Ud9YAUz2MEQljB90tVUORPeYgf/kh91MukU0gnWceiU16moU1mnRmLq6EQFWOr8S/2oa8XEusMAFgVhA6P/YAbDPz/1esKY03nDOCMeKxJYvQ47X66obZwVL+q8mijlbZ13dd4jFEwCHCwx6vsuDGABE9jASJY0f1RkTXmJCBABEhEgAiT/AFhg6LY5dtE2AAAAAElFTkSuQmCC';

type OpenInAppOptionWithFallback = OpenInAppOption & {
  fallbackIconDataUrl?: string;
};

const withFallbackIcon = (app: OpenInAppOption): OpenInAppOptionWithFallback => {
  if (app.id === 'finder') {
    if (window.__OPENCHAMBER_PLATFORM__ === 'linux') {
      return { ...app, fallbackIconDataUrl: FILES_DEFAULT_ICON_DATA_URL };
    }
    if (window.__OPENCHAMBER_PLATFORM__ !== 'win32') {
      return { ...app, fallbackIconDataUrl: FINDER_DEFAULT_ICON_DATA_URL };
    }
  }
  return {
    ...app,
    fallbackIconDataUrl: app.id === 'terminal' ? TERMINAL_DEFAULT_ICON_DATA_URL : undefined,
  };
};

const AppIcon = ({
  label,
  iconDataUrl,
  fallbackIconDataUrl,
}: {
  label: string;
  iconDataUrl?: string;
  fallbackIconDataUrl?: string;
}) => {
  const [failed, setFailed] = React.useState(false);
  const initial = label.trim().slice(0, 1).toUpperCase() || '?';

  const src = iconDataUrl || fallbackIconDataUrl;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className="h-4 w-4 rounded-sm"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        'h-4 w-4 rounded-sm flex items-center justify-center',
        'bg-[var(--surface-muted)] text-[9px] font-medium text-muted-foreground'
      )}
    >
      {initial}
    </span>
  );
};

type OpenInAppButtonProps = {
  directory: string;
  className?: string;
};

export const OpenInAppButton = ({ directory, className }: OpenInAppButtonProps) => {
  const { t } = useI18n();
  const selectedAppId = useOpenInAppsStore((state) => state.selectedAppId);
  const availableApps = useOpenInAppsStore((state) => state.availableApps);
  const isCacheStale = useOpenInAppsStore((state) => state.isCacheStale);
  const isScanning = useOpenInAppsStore((state) => state.isScanning);
  const initialize = useOpenInAppsStore((state) => state.initialize);
  const loadInstalledApps = useOpenInAppsStore((state) => state.loadInstalledApps);
  const selectApp = useOpenInAppsStore((state) => state.selectApp);

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  const isDesktopLocal = isDesktopShell() && isDesktopLocalOriginActive();

  const selectedApp = React.useMemo(() => {
    const known = availableApps.find((app) => app.id === selectedAppId)
      ?? availableApps.find((app) => app.id === DEFAULT_OPEN_IN_APP_ID)
      ?? availableApps[0]
      ?? OPEN_IN_APPS[0];
    if (known) {
      return withFallbackIcon(known);
    }
    return withFallbackIcon(OPEN_IN_APPS[0]);
  }, [availableApps, selectedAppId]);

  if (!isDesktopLocal || !directory) {
    return null;
  }

  if (availableApps.length === 0) {
    return null;
  }

  const handleOpen = async (app: OpenInAppOption) => {
    const opened = await openDesktopProjectInApp(directory, app.id, app.appName);
    if (!opened) {
      await openDesktopPath(directory, app.appName);
    }
  };

  const handleSelect = async (app: OpenInAppOption) => {
    await selectApp(app.id);
    await handleOpen(app);
  };

  const handleCopyPath = async () => {
    const text = directory;
    const result = await copyTextToClipboard(text);
    if (!result.ok) {
      return;
    }
    toast.success(t('openInApp.toast.pathCopied'));
  };

  return (
    <div
        className={cn(
          'app-region-no-drag inline-flex h-7 items-center self-center rounded-[9px] [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-[50px]',
          'bg-[var(--surface-elevated)] overflow-hidden',
          'border border-border/60',
          className
        )}
    >
      <button
        type="button"
        onClick={() => void handleOpen(selectedApp)}
        className={cn(
          'inline-flex h-full items-center px-2.5 typography-ui-label font-medium',
          'text-foreground hover:bg-interactive-hover transition-colors',
          isScanning && 'animate-pulse'
        )}
        aria-label={t('openInApp.actions.openInAria', { app: selectedApp.label })}
      >
        <AppIcon
          label={selectedApp.label}
          iconDataUrl={selectedApp.iconDataUrl}
          fallbackIconDataUrl={selectedApp.fallbackIconDataUrl}
        />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-full w-7 items-center justify-center',
              'border-l border-[var(--interactive-border)] text-muted-foreground',
              'hover:bg-interactive-hover hover:text-foreground transition-colors'
            )}
            aria-label={t('openInApp.actions.chooseAppAria')}
          >
            <Icon name="arrow-down-s" className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 max-h-[70vh] overflow-y-auto"
        >
          <DropdownMenuItem className="flex items-center gap-2" onClick={() => void handleCopyPath()}>
            <Icon name="file-copy" className="h-4 w-4" />
            <span className="typography-ui-label text-foreground">{t('openInApp.actions.copyPath')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {availableApps.map((app) => {
            const appWithFallback = withFallbackIcon(app);
            return (
              <DropdownMenuItem
                key={app.id}
                className="flex items-center gap-2"
                onClick={() => void handleSelect(app)}
              >
                <AppIcon
                  label={app.label}
                  iconDataUrl={app.iconDataUrl}
                  fallbackIconDataUrl={appWithFallback.fallbackIconDataUrl}
                />
                <span className="typography-ui-label text-foreground">{app.label}</span>
                {selectedApp.id === app.id ? (
                  <Icon name="check" className="ml-auto h-4 w-4 text-primary" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
          {isCacheStale ? (
            <DropdownMenuItem
              className="flex items-center gap-2"
              onClick={() => void loadInstalledApps(true)}
            >
              <Icon name="refresh" className="h-4 w-4" />
              <span className="typography-ui-label text-foreground">{t('openInApp.actions.refreshApps')}</span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
