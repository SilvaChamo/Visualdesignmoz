const memory = new Map<string, string>();

export function screenshotApiUrl(domain: string, width = 600) {
  return `/api/server-exec?action=getScreenshot&domain=${encodeURIComponent(domain)}&w=${width}`;
}

export function getCachedScreenshot(domain: string): string | null {
  const hit = memory.get(domain);
  if (!hit) return null;
  return hit;
}

async function fetchScreenshotBlob(domain: string, width = 600): Promise<Blob | null> {
  const res = await fetch(screenshotApiUrl(domain, width), { credentials: 'include', cache: 'no-store' });
  if (!res.ok) return null;
  const blob = await res.blob();
  if (blob.size < 2000 || !blob.type.startsWith('image/')) return null;
  return blob;
}

export async function prefetchScreenshot(domain: string, width = 600): Promise<string | null> {
  const cached = memory.get(domain);
  if (cached) return cached;

  const blob = await fetchScreenshotBlob(domain, width);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  memory.set(domain, url);
  return url;
}

export async function loadScreenshot(domain: string, width = 600): Promise<string | null> {
  const cached = memory.get(domain);
  if (cached) return cached;
  return prefetchScreenshot(domain, width);
}
