import { getWebApp, isTelegram, type CloudStorage } from '../tg/webapp';

/** Хранилище ключ-значение. Ключ: 1–128 символов [A-Za-z0-9_-], значение ≤ 4096 символов. */
export interface KV {
  getAll(): Promise<Record<string, string>>;
  set(k: string, v: string): Promise<void>;
  remove(k: string): Promise<void>;
}

/** Хранилище в памяти — для тестов. */
export function memoryKV(initial: Record<string, string> = {}): KV {
  const data = new Map(Object.entries(initial));
  return {
    async getAll() {
      return Object.fromEntries(data);
    },
    async set(k, v) {
      data.set(k, v);
    },
    async remove(k) {
      data.delete(k);
    },
  };
}

/** true — данные пойдут в Telegram CloudStorage (открыто в Telegram, Bot API ≥ 6.9). */
export function isTelegramStorage(): boolean {
  const wa = getWebApp();
  if (!wa || !isTelegram()) return false;
  try {
    return !!wa.CloudStorage && wa.isVersionAtLeast('6.9');
  } catch {
    return false;
  }
}

/** CloudStorage Telegram, если доступен; иначе localStorage; иначе память. */
export function createKV(): KV {
  if (isTelegramStorage()) return cloudKV(getWebApp()!.CloudStorage!);
  const ls = safeLocalStorage();
  return ls ? localStorageKV(ls) : memoryKV();
}

const BATCH = 100;

export function cloudKV(cs: CloudStorage): KV {
  const call = <T>(fn: (cb: (err: string | null, res?: T) => void) => void): Promise<T> =>
    new Promise((resolve, reject) => {
      try {
        fn((err, res) => (err ? reject(new Error(String(err))) : resolve(res as T)));
      } catch (e) {
        reject(e);
      }
    });

  return {
    async getAll() {
      const keys = (await call<string[]>((cb) => cs.getKeys(cb))) ?? [];
      const out: Record<string, string> = {};
      for (let i = 0; i < keys.length; i += BATCH) {
        const chunk = keys.slice(i, i + BATCH);
        const values = (await call<Record<string, string>>((cb) => cs.getItems(chunk, cb))) ?? {};
        for (const k of chunk) {
          const v = values[k];
          if (typeof v === 'string' && v !== '') out[k] = v;
        }
      }
      return out;
    },
    async set(k, v) {
      const ok = await call<boolean>((cb) => cs.setItem(k, v, cb));
      if (ok === false) throw new Error(`CloudStorage отклонил запись ${k}`);
    },
    async remove(k) {
      const ok = await call<boolean>((cb) => cs.removeItem(k, cb));
      if (ok === false) throw new Error(`CloudStorage отклонил удаление ${k}`);
    },
  };
}

const LS_PREFIX = 'kv:';

export function localStorageKV(ls: Storage): KV {
  return {
    async getAll() {
      const out: Record<string, string> = {};
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (key && key.startsWith(LS_PREFIX)) out[key.slice(LS_PREFIX.length)] = ls.getItem(key) ?? '';
      }
      return out;
    },
    async set(k, v) {
      ls.setItem(LS_PREFIX + k, v);
    },
    async remove(k) {
      ls.removeItem(LS_PREFIX + k);
    },
  };
}

export function safeLocalStorage(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return null;
    const probe = '__kv_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}
