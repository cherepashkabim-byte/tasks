import { describe, expect, it } from 'vitest';
import { memoryKV, type KV } from '../kv';
import { createStore } from './index';

/** Полдень локального дня — чтобы дата не зависела от часового пояса машины. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

function make(kv: KV, clock = at(2026, 10, 6)) {
  return createStore(kv, { snapshot: null, retryDelayMs: 0, now: () => clock });
}

describe('store: привычки', () => {
  it('add/update/remove, ключ b_<id>, отметки c_<id>_YYYY-MM; всё переживает load()', async () => {
    const kv = memoryKV();
    const store = make(kv);
    await store.load();

    const h = store.addHabit({ name: '  Чтение  ', emoji: '📖', color: '#4FA3FF', days: [0, 2, 4] });
    expect(h).toMatchObject({ name: 'Чтение', emoji: '📖', color: '#4FA3FF', days: [0, 2, 4], createdAt: at(2026, 10, 6) });
    const gym = store.addHabit({ name: 'Зал' });
    expect(gym.days).toEqual([0, 1, 2, 3, 4, 5, 6]); // по умолчанию — все дни

    store.updateHabit(h.id, { name: ' Книга ', days: [6, 1] });
    expect(store.getState().habits.find((x) => x.id === h.id)).toMatchObject({ name: 'Книга', days: [1, 6] });

    expect(store.toggleHabit(h.id, '2026-10-05')).toBe(true);
    expect(store.toggleHabit(h.id, '2026-10-06')).toBe(true);
    expect(store.toggleHabit(h.id, '2026-11-02')).toBe(true);
    expect(store.toggleHabit(h.id, '2026-10-06')).toBe(false); // повторный тап снимает
    expect(store.getState().habitChecks[h.id]).toEqual(['2026-10-05', '2026-11-02']);

    await store.flush();
    const data = await kv.getAll();
    expect(JSON.parse(data[`b_${h.id}`])).toMatchObject({ name: 'Книга' });
    expect(data[`c_${h.id}_2026-10`]).toBe('5');
    expect(data[`c_${h.id}_2026-11`]).toBe('2');

    const again = make(kv);
    await again.load();
    expect(again.getState().habits.map((x) => x.name)).toEqual(['Книга', 'Зал']);
    expect(again.getState().habitChecks[h.id]).toEqual(['2026-10-05', '2026-11-02']);
  });

  it('отметка = +1 в журнал дня, снятие = −1, не ниже 0; задачи и привычки складываются', async () => {
    const store = make(memoryKV());
    await store.load();
    const h = store.addHabit({ name: 'Зал' });
    const t = store.addTask({ title: 'Задача' });

    store.toggleHabit(h.id, '2026-10-06');
    expect(store.getState().activity).toEqual({ '2026-10-06': 1 });
    store.toggleDone(t.id);
    expect(store.getState().activity).toEqual({ '2026-10-06': 2 });
    store.toggleHabit(h.id, '2026-10-06');
    expect(store.getState().activity).toEqual({ '2026-10-06': 1 });
    store.toggleDone(t.id);
    expect(store.getState().activity).toEqual({});

  });

  it('снятие отметки, которой нет в журнале (a_ не записался), не уводит день в минус', async () => {
    const kv = memoryKV({
      meta: JSON.stringify({ v: 1, firstDay: '2026-10-01', activityMigrated: true }),
      b_hab0000001: JSON.stringify({ id: 'hab0000001', name: 'Баня', emoji: '🧖', color: '#FF8A4C', days: [6], createdAt: at(2026, 10, 1) }),
      'c_hab0000001_2026-10': '4',
    });
    const store = make(kv);
    await store.load();
    expect(store.getState().habitChecks).toEqual({ hab0000001: ['2026-10-04'] });
    expect(store.toggleHabit('hab0000001', '2026-10-04')).toBe(false);
    expect(store.getState().activity).toEqual({});
  });

  it('неподтверждённые облаком привычка и отметки из снимка переживают load() и дописываются', async () => {
    const inner = memoryKV();
    let failSet = false;
    const kv: KV = {
      getAll: () => inner.getAll(),
      remove: (k) => inner.remove(k),
      set: async (k, v) => {
        if (failSet) throw new Error('offline');
        return inner.set(k, v);
      },
    };
    let saved: string | null = null;
    const snapshot = { read: () => saved, write: (v: string) => void (saved = v) };
    const opts = { snapshot, retryDelayMs: 0, now: () => at(2026, 10, 6) };

    const first = createStore(kv, opts);
    await first.load();
    await first.flush();
    failSet = true;
    const h = first.addHabit({ name: 'Чтение', emoji: '📖' });
    first.toggleHabit(h.id, '2026-10-06');
    await first.flush();
    expect(Object.keys(await inner.getAll()).filter((k) => k.includes(h.id))).toEqual([]);

    failSet = false;
    const second = createStore(kv, opts);
    await second.load();
    await second.flush();
    expect(second.getState().habits.map((x) => x.name)).toEqual(['Чтение']);
    expect(second.getState().habitChecks[h.id]).toEqual(['2026-10-06']);
    expect(second.getState().activity).toEqual({ '2026-10-06': 1 });
    const data = await inner.getAll();
    expect(data[`c_${h.id}_2026-10`]).toBe('6');
    expect(data).toHaveProperty(`b_${h.id}`);
  });

  it('удаление привычки удаляет её b_ и c_ ключи, журнал активности остаётся', async () => {
    const kv = memoryKV();
    const store = make(kv);
    await store.load();
    const h = store.addHabit({ name: 'Баня' });
    const other = store.addHabit({ name: 'Зал' });
    store.toggleHabit(h.id, '2026-09-30');
    store.toggleHabit(h.id, '2026-10-06');
    store.toggleHabit(other.id, '2026-10-06');
    await store.flush();

    store.removeHabit(h.id);
    await store.flush();
    const keys = Object.keys(await kv.getAll());
    expect(keys.filter((k) => k.includes(h.id))).toEqual([]);
    expect(keys).toContain(`c_${other.id}_2026-10`);
    expect(store.getState().habits.map((x) => x.name)).toEqual(['Зал']);
    expect(store.getState().habitChecks[h.id]).toBeUndefined();
    expect(store.getState().activity).toEqual({ '2026-09-30': 1, '2026-10-06': 2 });

    const again = make(kv);
    await again.load();
    expect(again.getState().activity).toEqual({ '2026-09-30': 1, '2026-10-06': 2 });
  });
});
