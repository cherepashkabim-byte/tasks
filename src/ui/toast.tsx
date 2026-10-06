import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useRef, useState } from 'preact/hooks';

export type ToastOptions = {
  text: string;
  /** Кнопка в тосте, например «Отменить». */
  action?: { label: string; onClick: () => void };
  /** мс, по умолчанию 3000 */
  duration?: number;
  tone?: 'default' | 'danger';
};

type Toast = ToastOptions & { id: number };
type ToastApi = { show(opts: ToastOptions): void };

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const show = useCallback((opts: ToastOptions) => {
    window.clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ ...opts, id });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), opts.duration ?? 3000);
  }, []);

  const api = useRef<ToastApi>({ show }).current;

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast && (
        <div key={toast.id} class={`toast glass${toast.tone === 'danger' ? ' toast--danger' : ''}`} role="status">
          <span class="toast__text">{toast.text}</span>
          {toast.action && (
            <button
              class="toast__action"
              onClick={() => {
                toast.action!.onClick();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const t = useContext(Ctx);
  if (!t) throw new Error('useToast вне ToastProvider');
  return t;
}
