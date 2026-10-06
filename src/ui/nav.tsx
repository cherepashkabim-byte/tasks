import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { tg } from '../tg';
import { backAction } from './navModel';

export type TabId = 'due' | 'projects' | 'themes' | 'habits';

export const TABS: { id: TabId; title: string }[] = [
  { id: 'due', title: 'Сроки' },
  { id: 'projects', title: 'Проекты' },
  { id: 'themes', title: 'Темы' },
  { id: 'habits', title: 'Привычки' },
];

/** Вложенные экраны поверх вкладки. Новые экраны — добавить вариант сюда и ветку в App/NestedScreen. */
export type Route = { name: 'project'; id: string } | { name: 'theme'; id: string };

export type Nav = {
  tab: TabId;
  /** Переключить вкладку; стек вложенных экранов сбрасывается. */
  setTab(tab: TabId): void;
  stack: Route[];
  /** Верхний вложенный экран или null, если показана сама вкладка. */
  current: Route | null;
  push(route: Route): void;
  pop(): void;
};

const Ctx = createContext<Nav | null>(null);

/** Регистрирует открытую шторку; возвращает функцию снятия. */
type RegisterSheet = (close: () => void) => () => void;
const SheetCtx = createContext<RegisterSheet | null>(null);

export function NavProvider({ children }: { children: ComponentChildren }) {
  const [tab, setTabState] = useState<TabId>('due');
  const [stack, setStack] = useState<Route[]>([]);

  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    setStack([]);
  }, []);
  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  // Открытые шторки: последняя открытая закрывается кнопкой «Назад» первой.
  const sheets = useRef<{ close: () => void }[]>([]);
  const [sheetsVersion, setSheetsVersion] = useState(0);
  const registerSheet = useCallback<RegisterSheet>((close) => {
    const entry = { close };
    sheets.current = [...sheets.current, entry];
    setSheetsVersion((v) => v + 1);
    return () => {
      sheets.current = sheets.current.filter((e) => e !== entry);
      setSheetsVersion((v) => v + 1);
    };
  }, []);

  // Кнопка «Назад» Telegram: закрывает шторку, иначе вложенный экран; на вкладке скрыта.
  useEffect(() => {
    const action = backAction(sheets.current.length, stack.length);
    if (action === 'close-sheet') tg.backButton(true, () => sheets.current[sheets.current.length - 1]?.close());
    else tg.backButton(action === 'pop', pop);
  }, [stack.length, pop, sheetsVersion]);

  const value = useMemo<Nav>(
    () => ({ tab, setTab, stack, current: stack[stack.length - 1] ?? null, push, pop }),
    [tab, setTab, stack, push, pop],
  );
  return (
    <Ctx.Provider value={value}>
      <SheetCtx.Provider value={registerSheet}>{children}</SheetCtx.Provider>
    </Ctx.Provider>
  );
}

/** Пока active — кнопка «Назад» Telegram вызывает onClose (для нижних шторок), а не уходит с экрана. */
export function useBackCloses(active: boolean, onClose: () => void): void {
  const register = useContext(SheetCtx);
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    if (!active || !register) return;
    return register(() => latest.current());
  }, [active, register]);
}

export function useNav(): Nav {
  const n = useContext(Ctx);
  if (!n) throw new Error('useNav вне NavProvider');
  return n;
}
