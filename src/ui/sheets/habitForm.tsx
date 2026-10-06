import { createContext, type ComponentChildren, type ComponentType } from 'preact';
import { useContext, useMemo } from 'preact/hooks';
import type { Habit } from '../../store/types';
import { useSheetSession, type SheetFormProps } from './session';

export type HabitFormApi = { open(item?: Habit): void };
const HabitFormCtx = createContext<HabitFormApi | null>(null);

/** Одна шторка привычки на всё приложение: её открывают и экран «Привычки», и FAB. Саму форму передаёт App. */
export function HabitFormProvider({
  form: Form,
  children,
}: {
  form: ComponentType<SheetFormProps<Habit>>;
  children: ComponentChildren;
}) {
  const sheet = useSheetSession<Habit>();
  const show = sheet.show;
  const api = useMemo<HabitFormApi>(() => ({ open: (item) => show(item) }), [show]);
  return (
    <HabitFormCtx.Provider value={api}>
      {children}
      {sheet.session && (
        <Form key={sheet.session.key} open={sheet.open} item={sheet.session.item} onClose={sheet.close} />
      )}
    </HabitFormCtx.Provider>
  );
}

export function useHabitForm(): HabitFormApi {
  const f = useContext(HabitFormCtx);
  if (!f) throw new Error('useHabitForm вне HabitFormProvider');
  return f;
}
