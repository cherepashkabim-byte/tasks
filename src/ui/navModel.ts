/* Чистая логика навигации оболочки. Тесты — navModel.test.ts. */

export type BackAction = 'close-sheet' | 'pop' | 'hidden';

/** Что делает кнопка «Назад» Telegram: открытая шторка важнее вложенного экрана. */
export function backAction(openSheets: number, stackDepth: number): BackAction {
  if (openSheets > 0) return 'close-sheet';
  return stackDepth > 0 ? 'pop' : 'hidden';
}
