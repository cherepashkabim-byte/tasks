/* Подтверждение опасного действия вторым касанием: первое — «Точно …?», второе — выполнить; через 3 с само сбрасывается.
   Тесты — confirm.test.ts; в компонентах — через useConfirm(). */

export const CONFIRM_MS = 3000;

export type Confirm = {
  readonly armed: boolean;
  /** Первое касание взводит и возвращает false; второе выполняет action и возвращает true. */
  tap(action: () => void): boolean;
  /** Снять взведение (без действия). */
  reset(): void;
  /** Погасить таймер без уведомлений — при размонтировании. */
  dispose(): void;
};

export function createConfirm(onChange: (armed: boolean) => void, ms = CONFIRM_MS): Confirm {
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const set = (v: boolean) => {
    if (armed === v) return;
    armed = v;
    onChange(v);
  };

  return {
    get armed() {
      return armed;
    },
    tap(action) {
      if (!armed) {
        set(true);
        timer = setTimeout(() => {
          timer = undefined;
          set(false);
        }, ms);
        return false;
      }
      stop();
      set(false);
      action();
      return true;
    },
    reset() {
      stop();
      set(false);
    },
    dispose() {
      stop();
    },
  };
}
