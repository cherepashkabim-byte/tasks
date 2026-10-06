import { getWebApp, isTelegram, type WebApp } from './webapp';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

/** Цвета, в тон которых красится Telegram (совпадают с --bg в стилях). */
const APP_BG = '#0B0B12';

function safe(fn: (wa: WebApp) => void, minVersion = '6.0'): void {
  const wa = getWebApp();
  if (!wa || !isTelegram()) return;
  try {
    if (wa.isVersionAtLeast(minVersion)) fn(wa);
  } catch {
    /* старый клиент или нет метода — молча пропускаем, приложение работает и без этого */
  }
}

let currentBack: (() => void) | null = null;

/** Безопасная обёртка над Telegram.WebApp: вне Telegram все вызовы — no-op. */
export const tg = {
  isTelegram: isTelegram(),

  /** Сообщить Telegram о готовности, развернуть на весь экран, покрасить шапку и фон. */
  ready(): void {
    safe((wa) => wa.ready());
    safe((wa) => wa.expand());
    safe((wa) => {
      wa.setHeaderColor(APP_BG);
      wa.setBackgroundColor(APP_BG);
    }, '6.9');
    safe((wa) => wa.setBottomBarColor?.(APP_BG), '7.10');
    safe((wa) => wa.disableVerticalSwipes?.(), '7.7');
  },

  haptic(kind: HapticKind): void {
    safe((wa) => {
      const h = wa.HapticFeedback;
      if (kind === 'selection') h.selectionChanged();
      else if (kind === 'success' || kind === 'warning' || kind === 'error') h.notificationOccurred(kind);
      else h.impactOccurred(kind);
    }, '6.1');
  },

  /** Показать/скрыть кнопку «Назад» Telegram. Обработчик один: новый вызов заменяет прежний. */
  backButton(show: boolean, onClick?: () => void): void {
    safe((wa) => {
      if (currentBack) wa.BackButton.offClick(currentBack);
      currentBack = null;
      if (show) {
        if (onClick) {
          currentBack = onClick;
          wa.BackButton.onClick(onClick);
        }
        wa.BackButton.show();
      } else {
        wa.BackButton.hide();
      }
    }, '6.1');
  },
};
