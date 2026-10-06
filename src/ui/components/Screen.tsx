import type { ComponentChildren } from 'preact';
import { useNav } from '../nav';
import { IconBack } from './icons';

type Props = {
  title: string;
  /** Подзаголовок под названием (например «3 из 7»). */
  subtitle?: string;
  /** Показать стрелку «назад» (для вложенных экранов). */
  back?: boolean;
  /** Элементы справа от заголовка (кнопки действий). */
  actions?: ComponentChildren;
  children?: ComponentChildren;
};

/** Обёртка экрана: заголовок, прокручиваемое содержимое, анимация появления. */
export function Screen({ title, subtitle, back, actions, children }: Props) {
  const nav = useNav();
  return (
    <section class="screen">
      <header class="screen__header">
        {back && (
          <button class="icon-btn" aria-label="Назад" onClick={nav.pop}>
            <IconBack />
          </button>
        )}
        <div class="screen__titles">
          <h1 class="screen__title">{title}</h1>
          {subtitle && <div class="screen__subtitle">{subtitle}</div>}
        </div>
        {actions && <div class="screen__actions">{actions}</div>}
      </header>
      <div class="screen__body">{children}</div>
    </section>
  );
}

/** Пустое состояние / заглушка экрана. */
export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div class="empty glass">
      <div class="empty__emoji">{emoji}</div>
      <div class="empty__text">{text}</div>
    </div>
  );
}
