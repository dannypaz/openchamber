import * as React from 'react';

import { toast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n';
import { useUIStore } from '@/stores/useUIStore';
import { useUpdateStore } from '@/stores/useUpdateStore';
import { getDeferredSafeStorage } from '@/stores/utils/safeStorage';

const TOAST_ID = 'openchamber-app-update-available';
const DISMISSED_VERSION_KEY = 'openchamber-app-update-toast-dismissed-version';

export const AppUpdateToast: React.FC = () => {
  const { t } = useI18n();
  const available = useUpdateStore((state) => state.available);
  const runtimeType = useUpdateStore((state) => state.runtimeType);
  const version = useUpdateStore((state) => state.info?.version);
  const setUpdateDialogOpen = useUIStore((state) => state.setUpdateDialogOpen);
  const seenVersionsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    const isEligibleRuntime = runtimeType === 'desktop' || runtimeType === 'web';
    if (!isEligibleRuntime || !available || !version) {
      toast.dismiss(TOAST_ID);
      return;
    }

    if (getDeferredSafeStorage().getItem(DISMISSED_VERSION_KEY) === version) {
      return;
    }

    if (seenVersionsRef.current.has(version)) {
      return;
    }

    seenVersionsRef.current.add(version);

    toast.info(t('appUpdate.toast.available.title'), {
      id: TOAST_ID,
      description: t('appUpdate.toast.available.description', { version }),
      duration: Infinity,
      action: {
        label: t('appUpdate.toast.actions.view'),
        onClick: () => setUpdateDialogOpen(true),
      },
      cancel: {
        label: t('appUpdate.toast.actions.dismiss'),
        onClick: () => {
          getDeferredSafeStorage().setItem(DISMISSED_VERSION_KEY, version);
          toast.dismiss(TOAST_ID);
        },
      },
    });
  }, [available, runtimeType, setUpdateDialogOpen, t, version]);

  return null;
};
