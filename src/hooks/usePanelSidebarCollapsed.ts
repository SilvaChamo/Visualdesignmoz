'use client';

import { useCallback, useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

/** Barra lateral expandida no desktop; colapsada só em mobile (< 768px). */
export function usePanelSidebarCollapsed() {
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      setIsCollapsed(mobile);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setIsCollapsed(value);
  }, []);

  return { isCollapsed, setIsCollapsed: setCollapsed, isMobile };
}
