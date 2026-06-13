'use client';

import { useEffect, useState, type ReactNode } from 'react';

type PanelSectionKeepAliveProps = {
  activeSection: string;
  renderSection: (sectionId: string) => ReactNode;
};

/** Mantém secções visitadas montadas (display:none) para evitar re-fetch ao voltar ao menu. */
export function PanelSectionKeepAlive({ activeSection, renderSection }: PanelSectionKeepAliveProps) {
  const [mounted, setMounted] = useState<string[]>(() => [activeSection]);

  useEffect(() => {
    setMounted((prev) => (prev.includes(activeSection) ? prev : [...prev, activeSection]));
  }, [activeSection]);

  return (
    <>
      {mounted.map((sectionId) => (
        <div
          key={sectionId}
          className={sectionId === activeSection ? 'min-h-full' : 'hidden'}
          aria-hidden={sectionId !== activeSection}
        >
          {renderSection(sectionId)}
        </div>
      ))}
    </>
  );
}
