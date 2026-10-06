import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useBackCloses } from '../nav';
import { IconClose } from './icons';

const CLOSE_MS = 240;

type Props = {
  open: boolean;
  onClose(): void;
  title?: string;
  /** Элементы справа в шапке шторки (вместо крестика не ставятся — крестик есть всегда). */
  children?: ComponentChildren;
  /** Закреплённый низ шторки: кнопки «Сохранить» / «Удалить». */
  footer?: ComponentChildren;
};

/**
 * Нижняя стеклянная шторка. Появляется снизу, закрывается тапом по фону, крестиком,
 * Escape или свайпом вниз за ручку. Содержимое остаётся смонтированным, пока идёт анимация закрытия.
 */
export function Sheet({ open, onClose, title, children, footer }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDrag(0);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const id = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  // Telegram «Назад» сначала закрывает шторку, а не экран под ней.
  useBackCloses(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const onTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    setDrag(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (drag > 90) onClose();
    else setDrag(0);
    startY.current = null;
  };

  return (
    <div class={`sheet${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div class="sheet__backdrop" onClick={onClose} />
      <div
        class="sheet__panel"
        style={drag ? `transform: translateY(${drag}px); transition: none` : undefined}
      >
        <div class="sheet__grip" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span />
        </div>
        <header class="sheet__head" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <h2 class="sheet__title">{title}</h2>
          <button class="icon-btn icon-btn--sm" aria-label="Закрыть" onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <div class="sheet__body">{children}</div>
        {footer && <footer class="sheet__footer">{footer}</footer>}
      </div>
    </div>
  );
}
