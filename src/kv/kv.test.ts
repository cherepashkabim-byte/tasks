import { describe, expect, it } from 'vitest';
import type { CloudStorage } from '../tg/webapp';
import { cloudKV } from './index';

/** CloudStorage, который на каждую операцию отвечает «не выполнено» (ok === false) без текста ошибки. */
function refusingCloud(): CloudStorage {
  const no = (cb?: (err: string | null, ok?: boolean) => void) => cb?.(null, false);
  return {
    setItem: (_k: string, _v: string, cb?: (err: string | null, ok?: boolean) => void) => no(cb),
    removeItem: (_k: string, cb?: (err: string | null, ok?: boolean) => void) => no(cb),
  } as unknown as CloudStorage;
}

describe('cloudKV: отказ CloudStorage', () => {
  it('set превращает ok === false в ошибку', async () => {
    await expect(cloudKV(refusingCloud()).set('t_1', '{}')).rejects.toThrow();
  });

  it('remove превращает ok === false в ошибку так же, как set', async () => {
    await expect(cloudKV(refusingCloud()).remove('t_1')).rejects.toThrow();
  });
});
