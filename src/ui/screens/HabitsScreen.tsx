import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDate } from '../../dates';
import { habitStreak, habitStrip, type HabitDayStatus } from '../../dates/habits';
import type { Habit } from '../../store/types';
import { tg } from '../../tg';
import { Burst } from '../components/Burst';
import { IconCheck, IconPlus } from '../components/icons';
import { EmptyState, Screen } from '../components/Screen';
import { TaskGroup } from '../components/TaskList';
import { useToday } from '../hooks/useToday';
import { useAppState, useStore } from '../StoreContext';
import { useHabitForm } from '../sheets/habitForm';
import { allHabitsDone, daysLabel, HABITS_ALL_DONE, HABITS_EMPTY, splitHabits } from './model';

/** Сколько длятся частицы после отметки — как у задач. */
const BURST_MS = 640;

const STATUS_TITLE: Record<HabitDayStatus, string> = {
  done: 'выполнено',
  missed: 'пропущено',
  off: 'не по расписанию',
  before: 'до создания',
  pending: 'ждёт отметки',
};

/** Большая круглая галочка привычки: та же анимация и частицы, что у задач, цвета привычки. */
function HabitCheck({ habit, checked, today }: { habit: Habit; checked: boolean; today: string }) {
  const store = useStore();
  const [bursting, setBursting] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onTap = () => {
    const now = store.toggleHabit(habit.id, today);
    if (!now) {
      tg.haptic('light');
      setBursting(false);
      return;
    }
    tg.haptic('success');
    setBursting(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBursting(false), BURST_MS);
  };

  return (
    <button
      class={`check check--lg${checked ? ' is-checked' : ''}${bursting ? ' is-popping' : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Снять отметку: ${habit.name}` : `Отметить: ${habit.name}`}
      onClick={onTap}
    >
      <span class="check__ring">
        <IconCheck />
      </span>
      {bursting && <Burst size="lg" />}
    </button>
  );
}

type RowProps = { habit: Habit; checks: string[]; today: string; checkable: boolean; index: number };

/** Карточка привычки: эмодзи, название, расписание, полоска 7 дней и 🔥 серия. */
function HabitRow({ habit, checks, today, checkable, index }: RowProps) {
  const form = useHabitForm();
  const strip = habitStrip(habit, checks, today);
  const streak = habitStreak(habit, checks, today);
  const checked = checks.includes(today);
  return (
    <article
      class={`habit glass${checked && checkable ? ' is-done' : ''}`}
      style={`--sw:${habit.color}; --burst:${habit.color}; --i:${Math.min(index, 10)}`}
    >
      <button class="habit__body" onClick={() => form.open(habit)}>
        <span class="habit__badge">{habit.emoji}</span>
        <span class="habit__main">
          <span class="habit__name">{habit.name}</span>
          <span class="habit__meta">
            <span class={`habit__streak${streak ? '' : ' is-zero'}`}>🔥 {streak}</span>
            <span class="habit__days">{daysLabel(habit.days)}</span>
          </span>
          <span class="habit__strip" aria-label="Последние 7 дней">
            {strip.map((d) => (
              <i
                key={d.date}
                class={`hday hday--${d.status}${d.today ? ' is-today' : ''}`}
                title={`${formatDate(d.date, today)} — ${STATUS_TITLE[d.status]}`}
              />
            ))}
          </span>
        </span>
      </button>
      {checkable && <HabitCheck habit={habit} checked={checked} today={today} />}
    </article>
  );
}

/** Вкладка «Привычки»: «Сегодня» с большими галочками и «Остальные привычки». */
export function HabitsScreen() {
  const { habits, habitChecks, ready } = useAppState();
  const today = useToday();
  const form = useHabitForm();
  const split = splitHabits(habits, today);
  const doneToday = split.today.filter((h) => habitChecks[h.id]?.includes(today)).length;
  const allDone = allHabitsDone(split.today, habitChecks, today);

  return (
    <Screen
      title="Привычки"
      subtitle={split.today.length ? `Сегодня ${doneToday} из ${split.today.length}` : undefined}
      actions={
        <button class="icon-btn icon-btn--accent" aria-label="Новая привычка" onClick={() => form.open()}>
          <IconPlus />
        </button>
      }
    >
      {habits.length === 0 && ready ? (
        <EmptyState emoji="🔥" text={HABITS_EMPTY} />
      ) : (
        <>
          <TaskGroup title="Сегодня" tone="accent">
            {allDone && <div class="habits-done">{HABITS_ALL_DONE}</div>}
            {split.today.length ? (
              <div class="cards">
                {split.today.map((h, i) => (
                  <HabitRow key={h.id} habit={h} checks={habitChecks[h.id] ?? []} today={today} checkable index={i} />
                ))}
              </div>
            ) : (
              <div class="habits-none">На сегодня привычек нет — отдыхай 🌿</div>
            )}
          </TaskGroup>
          {split.rest.length > 0 && (
            <TaskGroup title="Остальные привычки" count={split.rest.length}>
              <div class="cards">
                {split.rest.map((h, i) => (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    checks={habitChecks[h.id] ?? []}
                    today={today}
                    checkable={false}
                    index={split.today.length + i}
                  />
                ))}
              </div>
            </TaskGroup>
          )}
        </>
      )}
    </Screen>
  );
}
