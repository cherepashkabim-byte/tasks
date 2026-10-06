export type Project = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: number;
  inbox?: true;
};

export type Theme = { id: string; name: string; color: string; createdAt: number };

export type Task = {
  id: string;
  title: string;
  note: string;
  projectId: string;
  themeId: string | null;
  /** YYYY-MM-DD в локальном часовом поясе или null */
  due: string | null;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
};

/** Журнал активности: 'YYYY-MM-DD' → сколько закрыто за день (нулевые дни не хранятся). */
export type Activity = Record<string, number>;

/** Привычка; days — дни недели по расписанию, 0 = пн … 6 = вс. */
export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  days: number[];
  createdAt: number;
};

/** Отметки привычек: id привычки → отмеченные дни 'YYYY-MM-DD' по возрастанию. */
export type HabitChecks = Record<string, string[]>;

export type State = {
  projects: Project[];
  themes: Theme[];
  tasks: Task[];
  /** Переживает удаление задач и «Очистить выполненные». */
  activity: Activity;
  /** День первого запуска 'YYYY-MM-DD'; null — до первой загрузки. */
  firstDay: string | null;
  habits: Habit[];
  habitChecks: HabitChecks;
  ready: boolean;
};
