import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { State, Store } from '../store';

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ store, children }: { store: Store; children: ComponentChildren }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Методы стора: addTask, toggleDone, removeProject… */
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore вне StoreProvider');
  return s;
}

/** Текущее состояние; компонент перерисуется при любом изменении. */
export function useAppState(): State {
  const store = useStore();
  const [state, setState] = useState(store.getState());
  useEffect(() => {
    setState(store.getState());
    return store.subscribe(setState);
  }, [store]);
  return state;
}
