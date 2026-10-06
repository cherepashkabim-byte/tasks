import { useMemo } from 'preact/hooks';
import type { Theme } from '../../store/types';
import { tg } from '../../tg';
import { IconChevron, IconPlus } from '../components/icons';
import { EmptyState, Screen } from '../components/Screen';
import { useNav } from '../nav';
import { useAppState } from '../StoreContext';
import { ThemeForm } from './forms';
import { useSheetSession } from '../sheets/session';
import { activeByTheme, plural } from './model';

/** Вкладка «Темы»: метки с цветом и счётчиком активных задач. */
export function ThemesScreen() {
  const { themes, tasks, ready } = useAppState();
  const nav = useNav();
  const form = useSheetSession<Theme>();
  const counts = useMemo(() => activeByTheme(tasks), [tasks]);

  return (
    <Screen
      title="Темы"
      subtitle={themes.length ? `${themes.length} ${plural(themes.length, ['тема', 'темы', 'тем'])}` : undefined}
      actions={
        <button class="icon-btn icon-btn--accent" aria-label="Новая тема" onClick={() => form.show()}>
          <IconPlus />
        </button>
      }
    >
      {themes.length === 0 && ready ? (
        <EmptyState
          emoji="🏷️"
          text="Темы — это цветные метки через все проекты: «Работа», «Дом», «Здоровье». Нажми + вверху, чтобы создать первую"
        />
      ) : (
        <div class="cards">
          {themes.map((t, i) => {
            const n = counts.get(t.id) ?? 0;
            return (
              <button
                key={t.id}
                class="tcard glass"
                style={`--sw:${t.color}; --i:${Math.min(i, 10)}`}
                onClick={() => {
                  tg.haptic('light');
                  nav.push({ name: 'theme', id: t.id });
                }}
              >
                <span class="tcard__dot" />
                <span class="tcard__name">{t.name}</span>
                <span class={`tcard__count${n ? '' : ' is-zero'}`}>
                  {n ? `${n} ${plural(n, ['активная', 'активные', 'активных'])}` : 'нет активных'}
                </span>
                <span class="pcard__chev">
                  <IconChevron />
                </span>
              </button>
            );
          })}
        </div>
      )}
      {form.session && (
        <ThemeForm key={form.session.key} open={form.open} item={form.session.item} onClose={form.close} />
      )}
    </Screen>
  );
}
