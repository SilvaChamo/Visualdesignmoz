export const PANEL_HOSTING_EDIT_USER_KEY = 'vd-hosting-edit-user';

export function queueHostingAccountEdit(userName: string): void {
  if (typeof window === 'undefined') return;
  const name = String(userName || '').trim();
  if (!name) return;
  try {
    sessionStorage.setItem(PANEL_HOSTING_EDIT_USER_KEY, name);
  } catch {
    /* quota */
  }
}

export function consumeHostingAccountEdit(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(PANEL_HOSTING_EDIT_USER_KEY)?.trim() || null;
    if (value) sessionStorage.removeItem(PANEL_HOSTING_EDIT_USER_KEY);
    return value;
  } catch {
    return null;
  }
}
