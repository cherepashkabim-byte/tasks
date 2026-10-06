import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIRM_MS, createConfirm } from './confirm';

describe('подтверждение вторым касанием', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('первое касание взводит, второе выполняет действие', () => {
    const changes: boolean[] = [];
    const action = vi.fn();
    const c = createConfirm((armed) => changes.push(armed));
    expect(c.tap(action)).toBe(false);
    expect(c.armed).toBe(true);
    expect(action).not.toHaveBeenCalled();
    expect(c.tap(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(c.armed).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('само сбрасывается через 3 секунды, и тогда касание снова только взводит', () => {
    const action = vi.fn();
    const c = createConfirm(() => {});
    expect(CONFIRM_MS).toBe(3000);
    c.tap(action);
    vi.advanceTimersByTime(2999);
    expect(c.armed).toBe(true);
    vi.advanceTimersByTime(1);
    expect(c.armed).toBe(false);
    expect(c.tap(action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('после выполнения старый таймер не сбрасывает новое взведение раньше срока', () => {
    const c = createConfirm(() => {});
    c.tap(() => {});
    vi.advanceTimersByTime(2000);
    c.tap(() => {});
    c.tap(() => {});
    vi.advanceTimersByTime(2000);
    expect(c.armed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(c.armed).toBe(false);
  });

  it('dispose гасит таймер без лишних уведомлений', () => {
    const changes: boolean[] = [];
    const c = createConfirm((a) => changes.push(a));
    c.tap(() => {});
    c.dispose();
    vi.advanceTimersByTime(5000);
    expect(changes).toEqual([true]);
  });
});
