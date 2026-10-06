import { tg } from '../../tg';
import { TABS, useNav, type TabId } from '../nav';
import { IconCalendar, IconFlame, IconFolder, IconTag } from './icons';

const ICONS: Record<TabId, () => preact.JSX.Element> = {
  due: IconCalendar,
  projects: IconFolder,
  themes: IconTag,
  habits: IconFlame,
};

/** Стеклянная нижняя панель из четырёх вкладок. */
export function TabBar() {
  const nav = useNav();
  return (
    <nav class="tabbar glass" aria-label="Разделы">
      {TABS.map(({ id, title }) => {
        const Icon = ICONS[id];
        const active = nav.tab === id && nav.stack.length === 0;
        return (
          <button
            key={id}
            class={`tabbar__item${nav.tab === id ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (nav.tab !== id || nav.stack.length) tg.haptic('selection');
              nav.setTab(id);
            }}
          >
            <Icon />
            <span>{title}</span>
          </button>
        );
      })}
    </nav>
  );
}
