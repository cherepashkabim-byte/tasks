import { describe, expect, it } from 'vitest';
import { backAction } from './navModel';

describe('кнопка «Назад» Telegram', () => {
  it('сначала закрывает открытую шторку, потом вложенный экран, на вкладке скрыта', () => {
    expect(backAction(1, 1)).toBe('close-sheet');
    expect(backAction(1, 0)).toBe('close-sheet');
    expect(backAction(0, 2)).toBe('pop');
    expect(backAction(0, 0)).toBe('hidden');
  });
});
