import { useEffect, useRef, useState } from 'preact/hooks';
import { tg } from '../../tg';
import { createConfirm, type Confirm } from './confirm';

/** Единое подтверждение удаления для всех мест: первое касание — «Точно …?» (haptic warning), второе — действие, сброс через 3 с. */
export function useConfirm(): { armed: boolean; tap(action: () => void): void; reset(): void } {
  const [armed, setArmed] = useState(false);
  const ref = useRef<Confirm | null>(null);
  if (!ref.current) ref.current = createConfirm(setArmed);
  const c = ref.current;
  useEffect(() => () => c.dispose(), []);
  return {
    armed,
    tap(action) {
      if (!c.tap(action)) tg.haptic('warning');
    },
    reset: () => c.reset(),
  };
}
