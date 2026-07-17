import * as React from 'react';
import { isDesktopLocalOriginActive, isDesktopShell } from '@/lib/desktop';
import { desktopHostsGet, getDesktopHostApiUrl, locationMatchesHost, redactSensitiveUrl } from '@/lib/desktopHosts';
import { getRuntimeApiBaseUrl } from '@/lib/runtime-switch';

const formatCompactInstanceLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0];
    const second = words[1].slice(0, 3);
    const shortTwoWord = `${first} ${second}`.trim();
    if (words.length > 2 || shortTwoWord.length < trimmed.length) {
      return `${shortTwoWord}...`;
    }
    return shortTwoWord;
  }

  return trimmed.length > 12 ? `${trimmed.slice(0, 9).trimEnd()}...` : trimmed;
};

export type DesktopInstanceLabelState = {
  isDesktopApp: boolean;
  currentInstanceLabel: string;
  compactCurrentInstanceLabel: string;
  currentInstanceIsLocal: boolean;
  refreshCurrentInstanceLabel: () => Promise<void>;
};

/**
 * Tracks which desktop host (local or a saved remote instance) the app is
 * currently pointed at. Local/remote instances are an Electron-only concept
 * — isDesktopApp is false everywhere else, and refresh is a no-op there.
 * Shared by every surface that displays or switches the current instance
 * (header tag, chat composer instance switcher).
 */
export function useDesktopInstanceLabel(): DesktopInstanceLabelState {
  const [isDesktopApp, setIsDesktopApp] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return isDesktopShell();
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setIsDesktopApp(isDesktopShell());
  }, []);
  const [currentInstanceLabel, setCurrentInstanceLabel] = React.useState('Local');
  const [currentInstanceIsLocal, setCurrentInstanceIsLocal] = React.useState(true);

  const refreshCurrentInstanceLabel = React.useCallback(async () => {
    if (typeof window === 'undefined' || !isDesktopApp) {
      return;
    }

    try {
      if (isDesktopLocalOriginActive()) {
        setCurrentInstanceLabel('Local');
        setCurrentInstanceIsLocal(true);
        return;
      }
      setCurrentInstanceIsLocal(false);

      const cfg = await desktopHostsGet();
      const localOrigin = window.__OPENCHAMBER_LOCAL_ORIGIN__ || window.location.origin;
      const runtimeApiBaseUrl = getRuntimeApiBaseUrl();

      if (runtimeApiBaseUrl && locationMatchesHost(runtimeApiBaseUrl, localOrigin)) {
        setCurrentInstanceLabel('Local');
        setCurrentInstanceIsLocal(true);
        return;
      }

      const match = cfg.hosts.find((host) => {
        return runtimeApiBaseUrl ? locationMatchesHost(runtimeApiBaseUrl, getDesktopHostApiUrl(host)) : false;
      });

      if (match?.label?.trim()) {
        setCurrentInstanceLabel(redactSensitiveUrl(match.label.trim()));
        return;
      }

      setCurrentInstanceLabel('Instance');
    } catch {
      setCurrentInstanceLabel('Local');
      setCurrentInstanceIsLocal(true);
    }
  }, [isDesktopApp]);

  React.useEffect(() => {
    void refreshCurrentInstanceLabel();
  }, [refreshCurrentInstanceLabel]);

  const compactCurrentInstanceLabel = React.useMemo(
    () => formatCompactInstanceLabel(currentInstanceLabel),
    [currentInstanceLabel],
  );

  return {
    isDesktopApp,
    currentInstanceLabel,
    compactCurrentInstanceLabel,
    currentInstanceIsLocal,
    refreshCurrentInstanceLabel,
  };
}
