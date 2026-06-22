'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type SidebarFlyoutSubItem = {
  id: string;
  label: string;
  isHeader?: boolean;
  badge?: React.ReactNode;
};

type ChildButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
};

type SidebarMenuFlyoutProps = {
  label: string;
  subItems: SidebarFlyoutSubItem[];
  activeSection: string;
  resolveSectionId: (id: string) => string;
  onSubNavigate: (id: string) => void;
  children: React.ReactElement<ChildButtonProps>;
};

const SUB_ROW_CLASS =
  'box-border flex h-8 min-h-8 max-h-8 w-full items-center px-3 text-left text-[15px] leading-none transition-colors duration-200 focus:outline-none';

export function SidebarMenuFlyout({
  label,
  subItems,
  activeSection,
  resolveSectionId,
  onSubNavigate,
  children,
}: SidebarMenuFlyoutProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelWidth = 220;
    const left = Math.min(rect.right + 4, window.innerWidth - panelWidth - 8);
    setPos({ top: rect.top, left: Math.max(8, left) });
  }, []);

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  const navigableItems = subItems.filter((s) => !s.isHeader);
  if (navigableItems.length === 0) return children;

  const child = React.cloneElement(children, {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      children.props.onClick?.(e);
      updatePosition();
      setOpen((v) => !v);
    },
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      children.props.onMouseEnter?.(e);
      updatePosition();
      show();
    },
  });

  const flyoutPanel =
    open && mounted ? (
      <div
        style={{ position: 'fixed', top: pos.top, left: pos.left }}
        className="z-[200] min-w-[210px] max-w-[260px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <div className="border-b border-zinc-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {label}
        </div>
        <div className="max-h-[55vh] overflow-y-auto py-0.5">
          {subItems.map((sub) => {
            if (sub.isHeader) {
              return (
                <div
                  key={sub.id}
                  className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                >
                  {sub.label.replace(/^—\s*|\s*—$/g, '')}
                </div>
              );
            }
            const resolved = resolveSectionId(sub.id);
            const isSubActive = resolveSectionId(activeSection) === resolved;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  onSubNavigate(sub.id);
                  setOpen(false);
                }}
                className={cn(
                  SUB_ROW_CLASS,
                  isSubActive
                    ? 'font-bold text-red-600'
                    : 'text-gray-600 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400',
                )}
              >
                <span className="relative flex flex-1 items-center gap-2 truncate">
                  {sub.label}
                  {sub.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div ref={anchorRef} className="relative" onMouseEnter={show} onMouseLeave={hide}>
        {child}
      </div>
      {flyoutPanel ? createPortal(flyoutPanel, document.body) : null}
    </>
  );
}
