import { todayISO } from '../dates';
import { safeLocalStorage, type KV } from '../kv';
import { PALETTE } from './palette';
import type { Activity, Habit, HabitChecks, Project, State, Task, Theme } from './types';

export type { Activity, Habit, HabitChecks, Project, State, Task, Theme } from './types';
export { PALETTE } from './palette';

/** Облако Telegram держит около 1024 ключей; после стольких занятых ключей показываем предупреждение. */
export const STORAGE_WARN_LIMIT = 900;
export const TITLE_MAX = 200;
export const NOTE_MAX = 1000;
export const INBOX_NAME = 'Входящие';
/** Общий предел названия проекта, темы и привычки. */
export const NAME_MAX = 60;
/** Все дни недели, 0 = пн … 6 = вс. */
export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** Сколько ключей облака занимает состояние: p_, h_, t_, b_, по c_ на месяц отметок привычки, по a_ на месяц журнала и meta. */
export function storageKeyCount(state: State): number {
  let n = 1 + state.projects.length + state.themes.length + state.tasks.length + state.habits.length;
  for (const days of Object.values(state.habitChecks)) n += new Set(days.map((d) => d.slice(0, 7))).size;
  n += new Set(Object.keys(state.activity).map((d) => d.slice(0, 7))).size;
  return n;
}

export function isNearStorageLimit(state: State): boolean {
  return storageKeyCount(state) > STORAGE_WARN_LIMIT;
}

/** Где лежит локальный снимок для мгновенного старта. */
export interface SnapshotStorage {
  read(): string | null;
  write(value: string): void;
}

export interface StoreOptions {
  /** undefined — localStorage; null — без снимка (тесты). */
  snapshot?: SnapshotStorage | null;
  /** Пауза перед повтором записи, умножается на номер попытки. */
  retryDelayMs?: number;
  now?: () => number;
  newId?: () => string;
}

export type ProjectInput = { name: string; emoji?: string; color?: string };
export type ProjectPatch = Partial<Pick<Project, 'name' | 'emoji' | 'color'>>;
export type ThemeInput = { name: string; color?: string };
export type ThemePatch = Partial<Pick<Theme, 'name' | 'color'>>;
export type TaskInput = {
  title: string;
  note?: string;
  projectId?: string | null;
  themeId?: string | null;
  due?: string | null;
};
export type TaskPatch = Partial<Pick<Task, 'title' | 'note' | 'projectId' | 'themeId' | 'due'>>;
export type HabitInput = { name: string; emoji?: string; color?: string; days?: number[] };
export type HabitPatch = Partial<Pick<Habit, 'name' | 'emoji' | 'color' | 'days'>>;
export type ErrorListener = (message: string, error: unknown) => void;

export const ERR_RETRY = 'Не удалось сохранить в облако, повторю';
export const ERR_GAVE_UP = 'Не удалось сохранить в облако. Изменения остались на устройстве';
export const ERR_LOAD = 'Не удалось загрузить данные из облака';

const MAX_RETRIES = 3;
const SNAPSHOT_KEY = 'tasks_snapshot_v1';
const META_KEY = 'meta';
const SCHEMA_VERSION = 1;

const keyOf = {
  project: (id: string) => `p_${id}`,
  theme: (id: string) => `h_${id}`,
  task: (id: string) => `t_${id}`,
  /** Журнал активности за месяц 'YYYY-MM'. */
  activity: (month: string) => `a_${month}`,
  habit: (id: string) => `b_${id}`,
  /** Отметки привычки за месяц 'YYYY-MM': строка номеров дней «1,2,5». */
  check: (habitId: string, month: string) => `c_${habitId}_${month}`,
};

const ACTIVITY_PREFIX = 'a_';
const HABIT_PREFIX = 'b_';
const CHECK_PREFIX = 'c_';
/** Ключи, которые разбираются из «сырых» данных: неподтверждённые значения накладываются до разбора. */
const RAW_PREFIXES = [ACTIVITY_PREFIX, HABIT_PREFIX, CHECK_PREFIX];

/** Дни недели без повторов и мусора, по возрастанию; пусто — все дни. */
function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [...ALL_DAYS];
  const set = new Set(days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6));
  return set.size ? [...set].sort((a, b) => a - b) : [...ALL_DAYS];
}

type HabitData = Pick<State, 'habits' | 'habitChecks'>;

/** b_<id> → привычки; c_<habitId>_YYYY-MM → отметки (только у существующих привычек). */
function parseHabits(data: Record<string, string>): HabitData {
  const habits: Habit[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(HABIT_PREFIX)) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(v);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object' || typeof (obj as { id?: unknown }).id !== 'string') continue;
    habits.push({ ...(obj as Habit), days: normalizeDays((obj as Habit).days) });
  }
  const ids = new Set(habits.map((h) => h.id));
  const habitChecks: HabitChecks = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(CHECK_PREFIX)) continue;
    const m = /^c_(.+)_(\d{4}-\d{2})$/.exec(k);
    if (!m || !ids.has(m[1])) continue;
    const list = (habitChecks[m[1]] ??= []);
    for (const part of v.split(',')) {
      const day = Number(part);
      if (Number.isInteger(day) && day >= 1 && day <= 31) list.push(`${m[2]}-${String(day).padStart(2, '0')}`);
    }
  }
  for (const id of Object.keys(habitChecks)) habitChecks[id] = [...new Set(habitChecks[id])].sort();
  return { habits: habits.sort(byCreated), habitChecks };
}

type Meta = {
  v: number;
  firstDay?: string;
  /** Выполненные до появления журнала задачи уже засчитаны. */
  activityMigrated?: true;
};

/** Ключи a_YYYY-MM → { DD: n } собираются в один журнал 'YYYY-MM-DD' → n. */
function parseActivity(data: Record<string, string>): Activity {
  const out: Activity = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(ACTIVITY_PREFIX)) continue;
    const month = k.slice(ACTIVITY_PREFIX.length);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(v);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;
    for (const [day, n] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof n === 'number' && n > 0 && /^\d{2}$/.test(day)) out[`${month}-${day}`] = n;
    }
  }
  return out;
}

function parseMeta(raw: string | undefined): Meta | null {
  if (raw === undefined) return null;
  try {
    const m = JSON.parse(raw);
    return m && typeof m === 'object' ? (m as Meta) : null;
  } catch {
    return null;
  }
}

export function randomId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(10);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function localSnapshot(): SnapshotStorage | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  return {
    read: () => ls.getItem(SNAPSHOT_KEY),
    write: (v) => {
      try {
        ls.setItem(SNAPSHOT_KEY, v);
      } catch {
        /* переполнение localStorage — снимок не критичен, облако остаётся источником истины */
      }
    },
  };
}

type Snapshot = {
  projects: Project[];
  themes: Theme[];
  tasks: Task[];
  activity?: Activity;
  firstDay?: string | null;
  habits?: Habit[];
  habitChecks?: HabitChecks;
  /** Изменения, которые ещё не подтвердило облако: ключ → значение (null — удаление). */
  dirty: Record<string, string | null>;
};

type Entities = Pick<State, 'projects' | 'themes' | 'tasks'>;

function parseEntities(data: Record<string, string>): Entities {
  const out: Entities = { projects: [], themes: [], tasks: [] };
  for (const [k, v] of Object.entries(data)) {
    let obj: unknown;
    try {
      obj = JSON.parse(v);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object' || typeof (obj as { id?: unknown }).id !== 'string') continue;
    if (k.startsWith('p_')) out.projects.push(obj as Project);
    else if (k.startsWith('h_')) out.themes.push(obj as Theme);
    else if (k.startsWith('t_')) out.tasks.push(obj as Task);
  }
  return out;
}

const byCreated = <T extends { createdAt: number }>(a: T, b: T) => a.createdAt - b.createdAt;

function sortProjects(list: Project[]): Project[] {
  return [...list].sort((a, b) => (a.inbox ? -1 : b.inbox ? 1 : a.createdAt - b.createdAt));
}

export type Store = ReturnType<typeof createStore>;

export function createStore(kv: KV, opts: StoreOptions = {}) {
  const snapshot = opts.snapshot === undefined ? localSnapshot() : opts.snapshot;
  const retryDelayMs = opts.retryDelayMs ?? 1000;
  const now = opts.now ?? Date.now;
  const newId = opts.newId ?? randomId;

  let state: State = {
    projects: [],
    themes: [],
    tasks: [],
    activity: {},
    firstDay: null,
    habits: [],
    habitChecks: {},
    ready: false,
  };
  const listeners = new Set<(s: State) => void>();
  const errorListeners = new Set<ErrorListener>();

  // --- запись в облако ---------------------------------------------------
  /** Всё, что ещё не подтверждено облаком (в т.ч. то, что пишется прямо сейчас). */
  const dirty = new Map<string, string | null>();
  /** Очередь на запись; по ключу хранится только последнее значение. */
  const queue = new Map<string, string | null>();
  let worker: Promise<void> | null = null;
  /**
   * Серия сбоев: от первой неудачной записи до первой удачной или до конца очереди.
   * На серию — одно ERR_RETRY и одно ERR_GAVE_UP, сколько бы ключей ни упало.
   */
  let series: 'ok' | 'retrying' | 'gave-up' = 'ok';

  const emitError = (message: string, error: unknown) => {
    for (const fn of errorListeners) {
      try {
        fn(message, error);
      } catch {
        /* слушатель ошибок не должен ломать запись */
      }
    }
  };

  const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

  async function writeOne(key: string, value: string | null): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        if (value === null) await kv.remove(key);
        else await kv.set(key, value);
        series = 'ok';
        if (dirty.has(key) && dirty.get(key) === value) dirty.delete(key);
        saveSnapshot();
        return;
      } catch (error) {
        if (series === 'ok') {
          series = 'retrying';
          emitError(ERR_RETRY, error);
        }
        if (attempt >= MAX_RETRIES) {
          if (series !== 'gave-up') {
            series = 'gave-up';
            emitError(ERR_GAVE_UP, error);
          }
          return; // остаётся в dirty — допишется при следующем запуске
        }
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  async function drain(): Promise<void> {
    while (queue.size) {
      const [key, value] = queue.entries().next().value as [string, string | null];
      queue.delete(key);
      await writeOne(key, value);
    }
    series = 'ok'; // очередь пуста — следующий сбой начнёт новую серию
    worker = null;
  }

  function enqueue(key: string, value: string | null) {
    dirty.set(key, value);
    queue.set(key, value);
    if (!worker) worker = drain();
  }

  const put = (key: string, entity: object) => enqueue(key, JSON.stringify(entity));
  const del = (key: string) => enqueue(key, null);

  // --- состояние ---------------------------------------------------------
  function saveSnapshot() {
    if (!snapshot) return;
    const snap: Snapshot = {
      projects: state.projects,
      themes: state.themes,
      tasks: state.tasks,
      activity: state.activity,
      firstDay: state.firstDay,
      habits: state.habits,
      habitChecks: state.habitChecks,
      dirty: Object.fromEntries(dirty),
    };
    try {
      snapshot.write(JSON.stringify(snap));
    } catch {
      /* снимок не критичен */
    }
  }

  function setState(next: Partial<State>) {
    state = { ...state, ...next };
    saveSnapshot();
    for (const fn of listeners) fn(state);
  }

  function readSnapshot(): Snapshot | null {
    if (!snapshot) return null;
    try {
      const raw = snapshot.read();
      if (!raw) return null;
      const s = JSON.parse(raw) as Snapshot;
      if (!Array.isArray(s.projects) || !Array.isArray(s.tasks) || !Array.isArray(s.themes)) return null;
      return { ...s, dirty: s.dirty ?? {} };
    } catch {
      return null;
    }
  }

  const inbox = (): Project | undefined => state.projects.find((p) => p.inbox);
  const inboxId = (): string => inbox()?.id ?? '';
  const projectExists = (id: string | null | undefined) => !!id && state.projects.some((p) => p.id === id);
  const themeExists = (id: string | null | undefined) => !!id && state.themes.some((t) => t.id === id);

  function makeInbox(): Project {
    return { id: newId(), name: INBOX_NAME, emoji: '📥', color: PALETTE[0].hex, createdAt: now(), inbox: true };
  }

  /** Ровно один «Входящие»: создаёт, если нет; лишние (после сбоев загрузки) сливает в самый старый. */
  function normalizeInbox(e: Entities): Entities {
    const inboxes = e.projects.filter((p) => p.inbox).sort(byCreated);
    if (inboxes.length === 0) {
      const p = makeInbox();
      put(keyOf.project(p.id), p);
      return { ...e, projects: [p, ...e.projects] };
    }
    if (inboxes.length === 1) return e;
    const [keep, ...extra] = inboxes;
    const extraIds = new Set(extra.map((p) => p.id));
    for (const p of extra) del(keyOf.project(p.id));
    const tasks = e.tasks.map((t) => {
      if (!extraIds.has(t.projectId)) return t;
      const moved = { ...t, projectId: keep.id };
      put(keyOf.task(t.id), moved);
      return moved;
    });
    return { ...e, projects: e.projects.filter((p) => !extraIds.has(p.id)), tasks };
  }

  function applyDirty(e: Entities, pending: Record<string, string | null>): Entities {
    const maps = {
      p_: new Map(e.projects.map((x) => [x.id, x as object])),
      h_: new Map(e.themes.map((x) => [x.id, x as object])),
      t_: new Map(e.tasks.map((x) => [x.id, x as object])),
    };
    for (const [key, value] of Object.entries(pending)) {
      const prefix = key.slice(0, 2) as keyof typeof maps;
      if (key !== META_KEY && maps[prefix]) {
        const id = key.slice(2);
        if (value === null) maps[prefix].delete(id);
        else {
          try {
            maps[prefix].set(id, JSON.parse(value));
          } catch {
            continue;
          }
        }
      }
      enqueue(key, value);
    }
    return {
      projects: [...maps.p_.values()] as Project[],
      themes: [...maps.h_.values()] as Theme[],
      tasks: [...maps.t_.values()] as Task[],
    };
  }

  function commit(e: Entities, journal: Pick<State, 'activity' | 'firstDay'>, habits: HabitData) {
    setState({
      ...journal,
      ...habits,
      projects: sortProjects(e.projects),
      themes: [...e.themes].sort(byCreated),
      tasks: [...e.tasks].sort(byCreated),
      ready: true,
    });
  }

  async function load(): Promise<void> {
    const snap = readSnapshot();
    // мгновенный старт из локальной копии
    const snapHabits = (): HabitData => ({ habits: snap?.habits ?? [], habitChecks: snap?.habitChecks ?? {} });
    if (snap) commit(snap, { activity: snap.activity ?? {}, firstDay: snap.firstDay ?? null }, snapHabits());

    let entities: Entities;
    let activity: Activity;
    let meta: Meta | null;
    let habits: HabitData;
    let offline = false;
    try {
      const data = await kv.getAll();
      // неподтверждённые облаком журнал, привычки, отметки и meta важнее облачных значений
      if (snap) {
        for (const [k, v] of Object.entries(snap.dirty)) {
          if (k !== META_KEY && !RAW_PREFIXES.some((p) => k.startsWith(p))) continue;
          if (v === null) delete data[k];
          else data[k] = v;
        }
      }
      meta = parseMeta(data[META_KEY]);
      activity = parseActivity(data);
      habits = parseHabits(data);
      entities = parseEntities(data);
      if (snap) entities = applyDirty(entities, snap.dirty);
    } catch (error) {
      emitError(ERR_LOAD, error);
      entities = snap ?? { projects: [], themes: [], tasks: [] };
      activity = snap?.activity ?? {};
      habits = snapHabits();
      meta = snap?.firstDay ? { v: SCHEMA_VERSION, firstDay: snap.firstDay } : null;
      offline = true;
      if (snap) for (const [k, v] of Object.entries(snap.dirty)) enqueue(k, v);
    }
    const journal = prepareJournal(meta, entities, activity, offline);
    commit(normalizeInbox(entities), journal, habits);
  }

  /**
   * firstDay и разовый перенос уже выполненных задач в журнал; пишет meta, если она изменилась.
   * offline (облако не прочитано): ни миграции, ни записи meta — firstDay живёт только в памяти и снимке.
   */
  function prepareJournal(
    meta: Meta | null,
    e: Entities,
    activity: Activity,
    offline: boolean,
  ): Pick<State, 'activity' | 'firstDay'> {
    const next: Meta = { ...(meta ?? {}), v: meta?.v ?? SCHEMA_VERSION };
    if (!next.firstDay) {
      const created = [...e.projects, ...e.tasks].map((x) => x.createdAt).filter((n) => Number.isFinite(n));
      next.firstDay = todayISO(new Date(created.length ? Math.min(...created) : now()));
    }
    if (offline) return { activity, firstDay: next.firstDay };
    if (!next.activityMigrated) {
      // ставит значение, а не прибавляет: если a_ записались, а meta с флагом — нет, повтор не удвоит счёт
      const counted: Activity = {};
      for (const t of e.tasks) {
        if (!t.done || typeof t.doneAt !== 'number') continue;
        const day = todayISO(new Date(t.doneAt));
        counted[day] = (counted[day] ?? 0) + 1;
      }
      activity = { ...activity };
      const months = new Set<string>();
      for (const [day, n] of Object.entries(counted)) {
        if ((activity[day] ?? 0) >= n) continue;
        activity[day] = n;
        months.add(day.slice(0, 7));
      }
      for (const m of months) writeActivityMonth(activity, m);
      next.activityMigrated = true;
    }
    const changed = !meta || next.firstDay !== meta.firstDay || next.activityMigrated !== meta.activityMigrated;
    if (changed) put(META_KEY, next);
    return { activity, firstDay: next.firstDay };
  }

  // --- проекты -----------------------------------------------------------
  function addProject(input: ProjectInput): Project {
    const p: Project = {
      id: newId(),
      name: input.name.trim().slice(0, NAME_MAX),
      emoji: input.emoji ?? '📁',
      color: input.color ?? PALETTE[state.projects.length % PALETTE.length].hex,
      createdAt: now(),
    };
    put(keyOf.project(p.id), p);
    setState({ projects: sortProjects([...state.projects, p]) });
    return p;
  }

  function updateProject(id: string, patch: ProjectPatch): void {
    const cur = state.projects.find((p) => p.id === id);
    if (!cur) return;
    const next: Project = { ...cur, ...patch, id, inbox: cur.inbox };
    if (!next.inbox) delete next.inbox;
    if (patch.name !== undefined) next.name = patch.name.trim().slice(0, NAME_MAX);
    put(keyOf.project(id), next);
    setState({ projects: state.projects.map((p) => (p.id === id ? next : p)) });
  }

  /** Удаляет проект и все его задачи. «Входящие» удалить нельзя — вернёт false. */
  function removeProject(id: string): boolean {
    const cur = state.projects.find((p) => p.id === id);
    if (!cur || cur.inbox) return false;
    const gone = state.tasks.filter((t) => t.projectId === id);
    for (const t of gone) del(keyOf.task(t.id));
    del(keyOf.project(id));
    setState({
      projects: state.projects.filter((p) => p.id !== id),
      tasks: state.tasks.filter((t) => t.projectId !== id),
    });
    return true;
  }

  // --- темы --------------------------------------------------------------
  function addTheme(input: ThemeInput): Theme {
    const t: Theme = {
      id: newId(),
      name: input.name.trim().slice(0, NAME_MAX),
      color: input.color ?? PALETTE[state.themes.length % PALETTE.length].hex,
      createdAt: now(),
    };
    put(keyOf.theme(t.id), t);
    setState({ themes: [...state.themes, t] });
    return t;
  }

  function updateTheme(id: string, patch: ThemePatch): void {
    const cur = state.themes.find((t) => t.id === id);
    if (!cur) return;
    const next: Theme = { ...cur, ...patch, id };
    if (patch.name !== undefined) next.name = patch.name.trim().slice(0, NAME_MAX);
    put(keyOf.theme(id), next);
    setState({ themes: state.themes.map((t) => (t.id === id ? next : t)) });
  }

  /** Удаляет тему и снимает её с задач; задачи остаются. */
  function removeTheme(id: string): void {
    if (!state.themes.some((t) => t.id === id)) return;
    const tasks = state.tasks.map((t) => {
      if (t.themeId !== id) return t;
      const next = { ...t, themeId: null };
      put(keyOf.task(t.id), next);
      return next;
    });
    del(keyOf.theme(id));
    setState({ themes: state.themes.filter((t) => t.id !== id), tasks });
  }

  // --- задачи ------------------------------------------------------------
  function addTask(input: TaskInput): Task {
    const t: Task = {
      id: newId(),
      title: input.title.trim().slice(0, TITLE_MAX),
      note: (input.note ?? '').slice(0, NOTE_MAX),
      projectId: projectExists(input.projectId) ? input.projectId! : inboxId(),
      themeId: themeExists(input.themeId) ? input.themeId! : null,
      due: input.due ?? null,
      done: false,
      doneAt: null,
      createdAt: now(),
    };
    put(keyOf.task(t.id), t);
    setState({ tasks: [...state.tasks, t] });
    return t;
  }

  function replaceTask(next: Task) {
    put(keyOf.task(next.id), next);
    setState({ tasks: state.tasks.map((t) => (t.id === next.id ? next : t)) });
  }

  function updateTask(id: string, patch: TaskPatch): void {
    const cur = state.tasks.find((t) => t.id === id);
    if (!cur) return;
    const next: Task = { ...cur, ...patch, id };
    if (patch.title !== undefined) next.title = patch.title.trim().slice(0, TITLE_MAX);
    if (patch.note !== undefined) next.note = patch.note.slice(0, NOTE_MAX);
    if (patch.projectId !== undefined && !projectExists(patch.projectId)) next.projectId = inboxId();
    if (patch.themeId !== undefined && !themeExists(patch.themeId)) next.themeId = null;
    replaceTask(next);
  }

  /** Удаляет задачу и возвращает её — для «Отменить» через restoreTask. */
  function removeTask(id: string): Task | undefined {
    const cur = state.tasks.find((t) => t.id === id);
    if (!cur) return undefined;
    del(keyOf.task(id));
    setState({ tasks: state.tasks.filter((t) => t.id !== id) });
    return cur;
  }

  /** Возвращает удалённую задачу как была; если проекта/темы уже нет — во «Входящие» / без темы. */
  function restoreTask(task: Task): void {
    if (state.tasks.some((t) => t.id === task.id)) return;
    const t: Task = {
      ...task,
      projectId: projectExists(task.projectId) ? task.projectId : inboxId(),
      themeId: themeExists(task.themeId) ? task.themeId : null,
    };
    put(keyOf.task(t.id), t);
    setState({ tasks: [...state.tasks, t].sort(byCreated) });
  }

  // --- журнал активности ------------------------------------------------
  /** Пишет в ключ a_YYYY-MM все дни месяца из журнала; пустой месяц — удаляет ключ. */
  function writeActivityMonth(activity: Activity, month: string) {
    const days: Record<string, number> = {};
    for (const [iso, n] of Object.entries(activity)) if (iso.startsWith(`${month}-`)) days[iso.slice(8)] = n;
    if (Object.keys(days).length) put(keyOf.activity(month), days);
    else del(keyOf.activity(month));
  }

  /**
   * Сдвигает счётчик дня журнала на delta (не ниже 0) и пишет месяц в хранилище.
   * Внутренний шов: его зовут toggleDone и отметки привычек.
   */
  function bumpActivity(dateISO: string, delta: number): void {
    const cur = state.activity[dateISO] ?? 0;
    const n = Math.max(0, cur + delta);
    if (n === cur) return;
    const activity = { ...state.activity };
    if (n > 0) activity[dateISO] = n;
    else delete activity[dateISO];
    writeActivityMonth(activity, dateISO.slice(0, 7));
    setState({ activity });
  }

  function toggleDone(id: string): void {
    const cur = state.tasks.find((t) => t.id === id);
    if (!cur) return;
    const at = now();
    const today = todayISO(new Date(at));
    replaceTask({ ...cur, done: !cur.done, doneAt: cur.done ? null : at });
    if (!cur.done) bumpActivity(today, +1);
    else if (cur.doneAt !== null && todayISO(new Date(cur.doneAt)) === today) bumpActivity(today, -1);
  }

  // --- привычки ----------------------------------------------------------
  function addHabit(input: HabitInput): Habit {
    const h: Habit = {
      id: newId(),
      name: input.name.trim().slice(0, NAME_MAX),
      emoji: input.emoji ?? '✨',
      color: input.color ?? PALETTE[state.habits.length % PALETTE.length].hex,
      days: normalizeDays(input.days),
      createdAt: now(),
    };
    put(keyOf.habit(h.id), h);
    setState({ habits: [...state.habits, h] });
    return h;
  }

  function updateHabit(id: string, patch: HabitPatch): void {
    const cur = state.habits.find((h) => h.id === id);
    if (!cur) return;
    const next: Habit = { ...cur, ...patch, id };
    if (patch.name !== undefined) next.name = patch.name.trim().slice(0, NAME_MAX);
    if (patch.days !== undefined) next.days = normalizeDays(patch.days);
    put(keyOf.habit(id), next);
    setState({ habits: state.habits.map((h) => (h.id === id ? next : h)) });
  }

  /** Удаляет привычку и все её отметки; журнал активности не трогает. */
  function removeHabit(id: string): void {
    if (!state.habits.some((h) => h.id === id)) return;
    const months = new Set((state.habitChecks[id] ?? []).map((d) => d.slice(0, 7)));
    for (const m of months) del(keyOf.check(id, m));
    del(keyOf.habit(id));
    const habitChecks = { ...state.habitChecks };
    delete habitChecks[id];
    setState({ habits: state.habits.filter((h) => h.id !== id), habitChecks });
  }

  /** Ставит или снимает отметку привычки за день и двигает журнал активности. Возвращает, отмечена ли теперь. */
  function toggleHabit(habitId: string, dateISO: string): boolean {
    if (!state.habits.some((h) => h.id === habitId)) return false;
    const cur = state.habitChecks[habitId] ?? [];
    const was = cur.includes(dateISO);
    const list = was ? cur.filter((d) => d !== dateISO) : [...cur, dateISO].sort();
    const month = dateISO.slice(0, 7);
    const days = list.filter((d) => d.startsWith(`${month}-`)).map((d) => Number(d.slice(8)));
    if (days.length) enqueue(keyOf.check(habitId, month), days.join(','));
    else del(keyOf.check(habitId, month));
    const habitChecks = { ...state.habitChecks };
    if (list.length) habitChecks[habitId] = list;
    else delete habitChecks[habitId];
    setState({ habitChecks });
    bumpActivity(dateISO, was ? -1 : +1);
    return !was;
  }

  /** Удаляет выполненные задачи проекта; возвращает, сколько удалено. */
  function clearDone(projectId: string): number {
    const gone = state.tasks.filter((t) => t.projectId === projectId && t.done);
    if (!gone.length) return 0;
    for (const t of gone) del(keyOf.task(t.id));
    const ids = new Set(gone.map((t) => t.id));
    setState({ tasks: state.tasks.filter((t) => !ids.has(t.id)) });
    return gone.length;
  }

  return {
    load,
    getState: (): State => state,
    subscribe(fn: (s: State) => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onError(fn: ErrorListener): () => void {
      errorListeners.add(fn);
      return () => errorListeners.delete(fn);
    },
    /** Дождаться, пока все изменения уйдут в хранилище (или исчерпают повторы). */
    async flush(): Promise<void> {
      while (worker) await worker;
    },
    inboxId,
    addProject,
    updateProject,
    removeProject,
    addTheme,
    updateTheme,
    removeTheme,
    addTask,
    updateTask,
    removeTask,
    restoreTask,
    toggleDone,
    clearDone,
    addHabit,
    updateHabit,
    removeHabit,
    toggleHabit,
  };
}
