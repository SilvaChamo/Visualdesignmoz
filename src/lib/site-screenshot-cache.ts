const memory = new Map<string, string>();

function memKey(domain: string, width: number) {
  return `${domain.toLowerCase()}:${width}`;
}

export function screenshotApiUrl(domain: string, width = 600) {
  return `/api/server-exec?action=getScreenshot&domain=${encodeURIComponent(domain)}&w=${width}`;
}

export function getCachedScreenshot(domain: string, width = 600): string | null {
  return memory.get(memKey(domain, width)) ?? null;
}

async function fetchScreenshotBlob(domain: string, width = 600): Promise<Blob | null> {
  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!safeDomain) return null;

  const urls = [
    `/api/server-exec?action=getScreenshot&domain=${encodeURIComponent(safeDomain)}&w=${width}`,
    `/api/server-exec?action=getScreenshot&domain=${encodeURIComponent(safeDomain)}&w=${width}&proto=http`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size >= 2000 && blob.type.startsWith('image/')) return blob;
    } catch {
      /* tenta próximo */
    }
  }
  return null;
}

export async function prefetchScreenshot(domain: string, width = 600): Promise<string | null> {
  const key = memKey(domain, width);
  const cached = memory.get(key);
  if (cached) return cached;

  const blob = await fetchScreenshotBlob(domain, width);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  memory.set(key, url);
  return url;
}

export async function loadScreenshot(domain: string, width = 600): Promise<string | null> {
  const key = memKey(domain, width);
  const cached = memory.get(key);
  if (cached) return cached;
  return prefetchScreenshot(domain, width);
}
