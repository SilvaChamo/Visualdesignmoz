'use client';

import { useEffect, useState, type ReactNode } from 'react';

type PanelSectionKeepAliveProps = {
  activeSection: string;
  renderSection: (sectionId: string, isActive: boolean) => ReactNode;
};

/** Mantém secções visitadas montadas (display:none) para evitar re-fetch ao voltar ao menu. */
export function PanelSectionKeepAlive({ activeSection, renderSection }: PanelSectionKeepAliveProps) {
  const [mounted, setMounted] = useState<string[]>(() => [activeSection]);

  useEffect(() => {
    setMounted((prev) => (prev.includes(activeSection) ? prev : [...prev, activeSection]));
  }, [activeSection]);

  return (
    <>
      {mounted.map((sectionId) => {
        const isActive = sectionId === activeSection;
        return (
          <div
            key={sectionId}
            className={isActive ? 'min-h-full' : 'hidden'}
            aria-hidden={!isActive}
          >
            {renderSection(sectionId, isActive)}
          </div>
        );
      })}
    </>
  );
}
