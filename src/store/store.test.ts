import { describe, expect, it } from 'vitest';
import { memoryKV, type KV } from '../kv';
import { createStore, ERR_GAVE_UP, ERR_RETRY, isNearStorageLimit } from './index';

function make(kv: KV = memoryKV()) {
  return createStore(kv, { snapshot: null, retryDelayMs: 0 });
}

describe('store: первый запуск', () => {
  it('создаёт ровно один неудаляемый проект «Входящие»', async () => {
    const kv = memoryKV();
    const store = make(kv);
    await store.load();
    await store.flush();

    const { projects, ready } = store.getState();
    expect(ready).toBe(true);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: 'Входящие', inbox: true });
    expect(store.removeProject(projects[0].id)).toBe(false);
    expect(store.getState().projects).toHaveLength(1);

    const again = make(kv);
    await again.load();
    expect(again.getState().projects.filter((p) => p.inbox)).toHaveLength(1);
    expect(Object.keys(await kv.getAll()).filter((k) => k.startsWith('p_'))).toEqual([`p_${projects[0].id}`]);
  });
});

async function ready(kv: KV = memoryKV()) {
  const store = make(kv);
  await store.load();
  return store;
}

describe('store: задачи', () => {
  it('добавление без проекта уходит во «Входящие», правка, удаление и восстановление', async () => {
    const store = await ready();
    const inbox = store.getState().projects[0];

    const t = store.addTask({ title: '  Купить молоко  ', due: '2026-10-07' });
    expect(t).toMatchObject({ title: 'Купить молоко', projectId: inbox.id, themeId: null, done: false, doneAt: null });

    store.updateTask(t.id, { title: 'Купить кефир', note: 'обезжиренный' });
    expect(store.getState().tasks[0]).toMatchObject({ title: 'Купить кефир', note: 'обезжиренный', due: '2026-10-07' });

    const removed = store.removeTask(t.id);
    expect(store.getState().tasks).toHaveLength(0);
    store.restoreTask(removed!);
    expect(store.getState().tasks).toEqual([{ ...t, title: 'Купить кефир', note: 'обезжиренный' }]);
  });

  it('toggleDone ставит и снимает doneAt', async () => {
    let clock = 1000;
    const store = createStore(memoryKV(), { snapshot: null, retryDelayMs: 0, now: () => clock });
    await store.load();
    const t = store.addTask({ title: 'Позвонить' });
    clock = 5000;
    store.toggleDone(t.id);
    expect(store.getState().tasks[0]).toMatchObject({ done: true, doneAt: 5000 });
    store.toggleDone(t.id);
    expect(store.getState().tasks[0]).toMatchObject({ done: false, doneAt: null });
  });

  it('clearDone удаляет только выполненные задачи этого проекта', async () => {
    const store = await ready();
    const work = store.addProject({ name: 'Работа' });
    const a = store.addTask({ title: 'a', projectId: work.id });
    store.addTask({ title: 'b', projectId: work.id });
    const c = store.addTask({ title: 'c' });
    store.toggleDone(a.id);
    store.toggleDone(c.id);
    expect(store.clearDone(work.id)).toBe(1);
    expect(store.getState().tasks.map((t) => t.title).sort()).toEqual(['b', 'c']);
  });
});

describe('store: проекты и темы', () => {
  it('удаление проекта каскадно удаляет его задачи', async () => {
    const kv = memoryKV();
    const store = await ready(kv);
    const work = store.addProject({ name: 'Работа', emoji: '💼' });
    store.addTask({ title: 'отчёт', projectId: work.id });
    const keep = store.addTask({ title: 'своё' });
    expect(store.removeProject(work.id)).toBe(true);
    expect(store.getState().projects.map((p) => p.id)).not.toContain(work.id);
    expect(store.getState().tasks.map((t) => t.id)).toEqual([keep.id]);
    await store.flush();
    const keys = Object.keys(await kv.getAll());
    expect(keys.filter((k) => k.startsWith('t_'))).toEqual([`t_${keep.id}`]);
  });

  it('удаление темы снимает её с задач, задачи остаются', async () => {
    const store = await ready();
    const theme = store.addTheme({ name: 'Здоровье', color: '#3DDC97' });
    const t = store.addTask({ title: 'Зал', themeId: theme.id });
    expect(t.themeId).toBe(theme.id);
    store.removeTheme(theme.id);
    expect(store.getState().themes).toHaveLength(0);
    expect(store.getState().tasks).toMatchObject([{ id: t.id, themeId: null }]);
  });
});

describe('store: хранение', () => {
  it('данные переживают повторный load() на том же KV, каждая сущность — свой ключ', async () => {
    const kv = memoryKV();
    const store = await ready(kv);
    const p = store.addProject({ name: 'Дом', emoji: '🏠', color: '#FFC145' });
    const h = store.addTheme({ name: 'Срочно' });
    const t = store.addTask({ title: 'Полить цветы', projectId: p.id, themeId: h.id, due: '2026-10-10' });
    store.toggleDone(t.id);
    await store.flush();

    const inboxId = store.inboxId();
    const keys = Object.keys(await kv.getAll()).filter((k) => k !== 'meta' && !k.startsWith('a_')).sort();
    expect(keys).toEqual([`h_${h.id}`, `p_${inboxId}`, `p_${p.id}`, `t_${t.id}`].sort());

    const again = await ready(kv);
    const { ready: _r, ...before } = store.getState();
    const { ready: _r2, ...after } = again.getState();
    expect(after).toEqual(before);
  });
});

describe('store: ошибки записи', () => {
  it('KV, падающий на set: до 3 повторов, onError, состояние в памяти сохраняется', async () => {
    const inner = memoryKV();
    let failSet = false;
    const attempts: string[] = [];
    const kv: KV = {
      getAll: () => inner.getAll(),
      remove: (k) => inner.remove(k),
      async set(k, v) {
        if (failSet) {
          attempts.push(k);
          throw new Error('network');
        }
        return inner.set(k, v);
      },
    };
    const store = await ready(kv);
    await store.flush();
    const errors: string[] = [];
    store.onError((msg) => errors.push(msg));

    failSet = true;
    const t = store.addTask({ title: 'Не потеряй меня' });
    await store.flush();

    expect(attempts).toEqual([`t_${t.id}`, `t_${t.id}`, `t_${t.id}`, `t_${t.id}`]); // 1 попытка + 3 повтора
    expect(errors[0]).toBe('Не удалось сохранить в облако, повторю');
    expect(store.getState().tasks).toMatchObject([{ id: t.id, title: 'Не потеряй меня' }]);
  });

  it('незаписанное изменение из локальной копии дописывается в облако при следующем запуске', async () => {
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

    const first = createStore(kv, { snapshot, retryDelayMs: 0 });
    await first.load();
    await first.flush();
    failSet = true;
    const t = first.addTask({ title: 'Офлайн-задача' });
    await first.flush();
    expect(Object.keys(await inner.getAll())).not.toContain(`t_${t.id}`);

    failSet = false;
    const second = createStore(kv, { snapshot, retryDelayMs: 0 });
    await second.load();
    await second.flush();
    expect(second.getState().tasks.map((x) => x.id)).toEqual([t.id]);
    expect(Object.keys(await inner.getAll())).toContain(`t_${t.id}`);
  });
});

/** Полдень локального дня — чтобы дата не зависела от часового пояса машины. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

describe('store: журнал активности', () => {
  it('toggleDone: +1 за отметку, −1 за снятие в тот же день, не ниже 0; месяц — свой ключ a_YYYY-MM; переживает load()', async () => {
    const kv = memoryKV();
    let clock = at(2026, 10, 5);
    const store = createStore(kv, { snapshot: null, retryDelayMs: 0, now: () => clock });
    await store.load();
    const a = store.addTask({ title: 'a' });
    const b = store.addTask({ title: 'b' });

    store.toggleDone(a.id);
    store.toggleDone(b.id);
    expect(store.getState().activity).toEqual({ '2026-10-05': 2 });
    store.toggleDone(b.id); // снял в тот же день
    expect(store.getState().activity).toEqual({ '2026-10-05': 1 });

    clock = at(2026, 11, 2);
    store.toggleDone(a.id); // снял на следующий месяц — история 5 октября остаётся
    store.toggleDone(b.id);
    expect(store.getState().activity).toEqual({ '2026-10-05': 1, '2026-11-02': 1 });

    await store.flush();
    const data = await kv.getAll();
    expect(JSON.parse(data['a_2026-10'])).toEqual({ '05': 1 });
    expect(JSON.parse(data['a_2026-11'])).toEqual({ '02': 1 });

    const again = createStore(kv, { snapshot: null, retryDelayMs: 0, now: () => clock });
    await again.load();
    expect(again.getState().activity).toEqual({ '2026-10-05': 1, '2026-11-02': 1 });
  });
});

describe('store: журнал не стирается удалениями', () => {
  it('clearDone, removeTask и removeProject журнал не трогают', async () => {
    const kv = memoryKV();
    const clock = at(2026, 10, 6);
    const store = createStore(kv, { snapshot: null, retryDelayMs: 0, now: () => clock });
    await store.load();
    const work = store.addProject({ name: 'Работа' });
    const a = store.addTask({ title: 'a', projectId: work.id });
    const b = store.addTask({ title: 'b' });
    const c = store.addTask({ title: 'c' });
    for (const t of [a, b, c]) store.toggleDone(t.id);

    store.clearDone(store.inboxId());
    store.removeTask(a.id);
    store.removeProject(work.id);
    expect(store.getState().tasks).toHaveLength(0);
    expect(store.getState().activity).toEqual({ '2026-10-06': 3 });

    await store.flush();
    expect(JSON.parse((await kv.getAll())['a_2026-10'])).toEqual({ '06': 3 });
  });
});

describe('store: миграция журнала', () => {
  it('выполненные задачи с doneAt засчитываются один раз, firstDay — по самому раннему createdAt', async () => {
    const task = (id: string, createdAt: number, doneAt: number | null) =>
      JSON.stringify({ id, title: id, note: '', projectId: 'inb', themeId: null, due: null, done: doneAt !== null, doneAt, createdAt });
    const kv = memoryKV({
      meta: JSON.stringify({ v: 1 }),
      p_inb: JSON.stringify({ id: 'inb', name: 'Входящие', emoji: '📥', color: '#7C5CFF', createdAt: at(2026, 9, 20), inbox: true }),
      t_a: task('a', at(2026, 9, 14), at(2026, 9, 30)),
      t_b: task('b', at(2026, 9, 25), at(2026, 9, 30)),
      t_c: task('c', at(2026, 10, 1), at(2026, 10, 2)),
      t_d: task('d', at(2026, 10, 1), null),
    });
    const open = async () => {
      const s = createStore(kv, { snapshot: null, retryDelayMs: 0, now: () => at(2026, 10, 6) });
      await s.load();
      await s.flush();
      return s;
    };

    const first = await open();
    expect(first.getState().firstDay).toBe('2026-09-14');
    expect(first.getState().activity).toEqual({ '2026-09-30': 2, '2026-10-02': 1 });

    const second = await open();
    expect(second.getState().activity).toEqual({ '2026-09-30': 2, '2026-10-02': 1 });
    expect(second.getState().firstDay).toBe('2026-09-14');
  });

  it('новый пользователь: firstDay — сегодня', async () => {
    const store = createStore(memoryKV(), { snapshot: null, retryDelayMs: 0, now: () => at(2026, 10, 6) });
    await store.load();
    expect(store.getState().firstDay).toBe('2026-10-06');
  });
});

describe('store: миграция журнала при недоступном облаке', () => {
  it('сбой getAll не ставит флаг миграции: следующий load засчитывает done-задачи ровно один раз', async () => {
    const inner = memoryKV({
      meta: JSON.stringify({ v: 1 }),
      p_inb: JSON.stringify({ id: 'inb', name: 'Входящие', emoji: '📥', color: '#7C5CFF', createdAt: at(2026, 9, 20), inbox: true }),
      t_a: JSON.stringify({ id: 'a', title: 'a', note: '', projectId: 'inb', themeId: null, due: null, done: true, doneAt: at(2026, 10, 2), createdAt: at(2026, 9, 21) }),
    });
    let failGet = true;
    const kv: KV = {
      getAll: async () => {
        if (failGet) throw new Error('offline');
        return inner.getAll();
      },
      set: (k, v) => inner.set(k, v),
      remove: (k) => inner.remove(k),
    };
    let saved: string | null = null;
    const snapshot = { read: () => saved, write: (v: string) => void (saved = v) };
    const open = async () => {
      const s = createStore(kv, { snapshot, retryDelayMs: 0, now: () => at(2026, 10, 6) });
      await s.load();
      await s.flush();
      return s;
    };

    await open(); // облако недоступно
    failGet = false;
    expect((await open()).getState().activity).toEqual({ '2026-10-02': 1 });
    expect((await open()).getState().activity).toEqual({ '2026-10-02': 1 });
  });
});

describe('store: миграция журнала идемпотентна', () => {
  it('a_ записались, meta с флагом — нет, снимка нет: повторный load не считает дважды', async () => {
    const inner = memoryKV({
      meta: JSON.stringify({ v: 1 }),
      p_inb: JSON.stringify({ id: 'inb', name: 'Входящие', emoji: '📥', color: '#7C5CFF', createdAt: at(2026, 9, 20), inbox: true }),
      t_a: JSON.stringify({ id: 'a', title: 'a', note: '', projectId: 'inb', themeId: null, due: null, done: true, doneAt: at(2026, 10, 2), createdAt: at(2026, 9, 21) }),
      t_b: JSON.stringify({ id: 'b', title: 'b', note: '', projectId: 'inb', themeId: null, due: null, done: true, doneAt: at(2026, 10, 2), createdAt: at(2026, 9, 22) }),
    });
    let failMeta = true;
    const kv: KV = {
      getAll: () => inner.getAll(),
      set: async (k, v) => {
        if (failMeta && k === 'meta') throw new Error('network');
        return inner.set(k, v);
      },
      remove: (k) => inner.remove(k),
    };
    const open = async () => {
      const s = createStore(kv, { snapshot: null, retryDelayMs: 0, now: () => at(2026, 10, 6) });
      await s.load();
      await s.flush();
      return s;
    };

    await open();
    expect(JSON.parse((await inner.getAll())['a_2026-10'])).toEqual({ '02': 2 });
    expect(JSON.parse((await inner.getAll()).meta).activityMigrated).toBeUndefined();
    failMeta = false;
    expect((await open()).getState().activity).toEqual({ '2026-10-02': 2 });
    expect((await open()).getState().activity).toEqual({ '2026-10-02': 2 });
  });
});

describe('store: ошибки облака без сети', () => {
  it('каждая серия сбоев даёт ровно одно «повторю» и одно «не удалось»', async () => {
    let online = false;
    const base = memoryKV();
    const kv: KV = {
      getAll: () => base.getAll(),
      set: (k, v) => (online ? base.set(k, v) : Promise.reject(new Error('offline'))),
      remove: (k) => (online ? base.remove(k) : Promise.reject(new Error('offline'))),
    };
    const store = make(kv);
    const errors: string[] = [];
    store.onError((msg) => errors.push(msg));

    store.addTheme({ name: 'Раз' });
    store.addTheme({ name: 'Два' });
    store.addTheme({ name: 'Три' });
    await store.flush();
    expect(errors).toEqual([ERR_RETRY, ERR_GAVE_UP]);

    store.addTheme({ name: 'Четыре' });
    await store.flush();
    expect(errors).toEqual([ERR_RETRY, ERR_GAVE_UP, ERR_RETRY, ERR_GAVE_UP]);

    online = true;
    store.addTheme({ name: 'Пять' });
    await store.flush();
    expect(errors).toHaveLength(4);
  });
});

describe('store: предупреждение о лимите хранилища', () => {
  const habit = (i: number) => ({ id: `h${i}`, name: `П${i}`, emoji: '📖', color: '#fff', days: [0], createdAt: 0 });
  const empty = {
    projects: [{ id: 'in', name: 'Входящие', emoji: '📥', color: '#fff', createdAt: 0, inbox: true as const }],
    themes: [],
    tasks: [],
    activity: {},
    firstDay: null,
    habits: [],
    habitChecks: {},
    ready: true,
  };

  it('считает все ключи облака, а не только задачи', () => {
    // 300 привычек × (b_ + c_ за сентябрь + c_ за октябрь) = 900 ключей, плюс p_, a_ и meta — без единой задачи
    const habits = Array.from({ length: 300 }, (_, i) => habit(i));
    const habitChecks = Object.fromEntries(habits.map((h) => [h.id, ['2026-09-30', '2026-10-01', '2026-10-02']]));
    const state = { ...empty, habits, habitChecks, activity: { '2026-10-01': 3 } };
    expect(isNearStorageLimit(state)).toBe(true);
  });

  it('мало ключей — без предупреждения', () => {
    const habits = Array.from({ length: 10 }, (_, i) => habit(i));
    expect(isNearStorageLimit({ ...empty, habits })).toBe(false);
  });
});
