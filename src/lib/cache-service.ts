interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  
  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs
    });
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Limpar cache expirado
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

export const cacheService = new CacheService();

// Auto-limpeza a cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => cacheService.cleanup(), 5 * 60 * 1000);
}
