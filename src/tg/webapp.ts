/** Минимальные типы Telegram WebApp — только то, чем пользуется приложение. */

type Cb<T> = (err: string | null, result?: T) => void;

export interface CloudStorage {
  setItem(key: string, value: string, cb?: Cb<boolean>): void;
  getItem(key: string, cb: Cb<string>): void;
  getItems(keys: string[], cb: Cb<Record<string, string>>): void;
  removeItem(key: string, cb?: Cb<boolean>): void;
  removeItems(keys: string[], cb?: Cb<boolean>): void;
  getKeys(cb: Cb<string[]>): void;
}

export interface WebApp {
  initData: string;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  isVersionAtLeast(version: string): boolean;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  onEvent(event: string, handler: () => void): void;
  offEvent(event: string, handler: () => void): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  CloudStorage?: CloudStorage;
}

export function getWebApp(): WebApp | null {
  try {
    const w = globalThis as { Telegram?: { WebApp?: WebApp } };
    return w.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

/** Открыто внутри клиента Telegram: скрипт создаёт WebApp и вне Telegram, но initData там пустой. */
export function isTelegram(): boolean {
  const wa = getWebApp();
  return !!wa && typeof wa.initData === 'string' && wa.initData.length > 0;
}
