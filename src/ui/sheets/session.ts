import { useMemo, useRef, useState } from 'preact/hooks';
import { tg } from '../../tg';

/** Открытая шторка: key меняется при каждом открытии (свежее состояние формы), item — что редактируем. */
export type SheetSession<T> = { key: number; item?: T };

export type SheetControl<T> = {
  session: SheetSession<T> | null;
  /** false — шторка уезжает с анимацией; session живёт до следующего show. */
  open: boolean;
  show(item?: T): void;
  close(): void;
};

/** Единый механизм сессии шторки: открыть для нового/существующего объекта, закрыть с анимацией. */
export function useSheetSession<T>(): SheetControl<T> {
  const [session, setSession] = useState<SheetSession<T> | null>(null);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const actions = useMemo(
    () => ({
      show(item?: T) {
        tg.haptic('light');
        setSession({ key: ++seq.current, item });
        setOpen(true);
      },
      close() {
        setOpen(false);
      },
    }),
    [],
  );
  return { session, open, ...actions };
}

/** Пропсы любой шторки-формы, которой управляет useSheetSession. */
export type SheetFormProps<T> = {
  open: boolean;
  item?: T;
  onClose(): void;
  /** Объект удалён из формы (например, уйти с экрана удалённого проекта). */
  onDeleted?(): void;
};
