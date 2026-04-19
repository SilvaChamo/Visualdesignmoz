// Sistema de fila para serializar chamadas ao Supabase
// Evita "Lock broken by another request with the 'steal' option"

type QueueTask<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class SupabaseQueue {
  private queue: QueueTask<any>[] = [];
  private isProcessing = false;

  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;

      try {
        // Adicionar pequeno delay entre requisições para evitar conflitos
        await new Promise(resolve => setTimeout(resolve, 50));
        const result = await task.execute();
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
    }

    this.isProcessing = false;
  }
}

// Instância global da fila
const globalQueue = new SupabaseQueue();

// Wrapper para supabase com fila
export function withQueue<T>(execute: () => Promise<T>): Promise<T> {
  return globalQueue.enqueue(execute);
}

// Hook React para usar o supabase com fila
export function useSupabaseQueue() {
  return {
    enqueue: withQueue,
    auth: {
      getUser: () => withQueue(() => import('./supabase-client').then(m => m.supabase.auth.getUser())),
      signOut: () => withQueue(() => import('./supabase-client').then(m => m.supabase.auth.signOut())),
      updateUser: (data: any) => withQueue(() => import('./supabase-client').then(m => m.supabase.auth.updateUser(data))),
    },
    from: (table: string) => ({
      select: (columns: string = '*') => ({
        eq: (column: string, value: any) => ({
          order: (column: string, { ascending = true } = {}) => withQueue(() => 
            import('./supabase-client').then(m => 
              m.supabase.from(table).select(columns).eq(column, value).order(column, { ascending })
            )
          ),
          single: () => withQueue(() => 
            import('./supabase-client').then(m => 
              m.supabase.from(table).select(columns).eq(column, value).single()
            )
          ),
          maybeSingle: () => withQueue(() => 
            import('./supabase-client').then(m => 
              m.supabase.from(table).select(columns).eq(column, value).maybeSingle()
            )
          ),
        }),
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: File) => withQueue(() => 
          import('./supabase-client').then(m => m.supabase.storage.from(bucket).upload(path, file))
        ),
        getPublicUrl: (path: string) => {
          // getPublicUrl é síncrono, não precisa de fila
          const { supabase } = require('./supabase-client');
          return supabase.storage.from(bucket).getPublicUrl(path);
        },
      }),
    },
  };
}
