<!-- autopilot:start -->
# Мини-апп задач в Telegram

Telegram Mini App для личных задач и привычек: проекты (с «Входящими»), сквозные цветные темы, сроки, шкала прогресса проекта, привычки по дням недели, карта действий; без сервера, данные в Telegram CloudStorage. Один пользователь; UI на русском, на «ты».

Стек: Vite 8 + TypeScript 7 (strict) + Preact 11, тесты Vitest 5, Node 24. Других runtime-зависимостей нет.

## Команды

- Установка: `npm install`
- Запуск: `npm run dev` (http://localhost:5173, вне Telegram — на localStorage)
- Тесты: `npm test` (= `vitest run`, 10 файлов); один файл: `npx vitest run src/store/store.test.ts`
- Сборка: `npm run build` (= `tsc --noEmit && vite build` → `dist/`); просмотр: `npm run preview`

## Структура

```
src/main.tsx               tg.ready(), createStore(createKV()), render <App>
src/kv/                    KV {getAll,set,remove}: cloudKV / localStorageKV / memoryKV, выбор в createKV()
src/store/index.ts         createStore: проекты, темы, задачи, привычки, журнал; очередь записи, снимок, лимиты
src/store/types.ts         Project/Theme/Task/Habit/HabitChecks/Activity/State; palette.ts — PALETTE
src/dates/index.ts         корзины сроков, formatDue, todayISO/addDays; WEEKDAY_SHORT, MONTH_*, weekdayOf, mondayOf
src/dates/activity.ts      activityGrid / activityStreak (карта действий)
src/dates/habits.ts        isScheduled / habitStrip / habitStreak
src/tg/                    webapp.ts — свои типы Telegram.WebApp, isTelegram; index.ts — безопасная обёртка tg
src/ui/App.tsx             провайдеры, вкладки due/projects/themes/habits + NestedScreen (project/theme)
src/ui/nav.tsx             useNav, BackButton Telegram, useBackCloses; navModel.ts — backAction
src/ui/sheets/             session.ts — useSheetSession; habitForm.tsx — HabitFormProvider/useHabitForm
src/ui/hooks/              useConfirm/confirm.ts (удаление вторым касанием), useToday
src/ui/screens/            экраны + forms.tsx (Project/Theme/HabitForm); model.ts — чистые функции экранов
src/ui/editor/             TaskEditor (шторка задачи), Calendar; form.ts — чистые функции формы
src/ui/components/         Sheet, TaskList/TaskCard, Progress (+ProjectCelebration), ActivityMap, Burst, confetti, Fab, TabBar…
src/ui/styles/index.css    импортирует tokens/base/shell/tasks/editor/collections/activity/habits.css
.github/workflows/deploy.yml  push в main → npm ci, npm test, npm run build → GitHub Pages
```

## Подводные камни

- Ключи хранилища: `p_<id>` проект, `h_<id>` тема, `t_<id>` задача, `b_<id>` привычка (JSON); `c_<habitId>_YYYY-MM` = дни месяца `"1,2,5"`; `a_YYYY-MM` = `{"DD":n}` журнал; `meta` = `{v:1, firstDay, activityMigrated}`.
- Разбор в `src/store/index.ts`: `parseEntities` (p_/h_/t_), `parseHabits` (b_/c_), `parseActivity` (a_), `parseMeta`; новый префикс без них не прочитается, а для не-JSON-сущностей ещё и `RAW_PREFIXES` (наложение dirty).
- Лимиты CloudStorage: ключ 1–128 символов `[A-Za-z0-9_-]`, значение ≤ 4096, ~1024 ключа. `storageKeyCount(state)` считает все ключи (сущности + месяцы c_/a_ + meta); > `STORAGE_WARN_LIMIT=900` → предупреждение в ProjectsScreen.
- Пределы длины: `TITLE_MAX=200`, `NOTE_MAX=1000`, `NAME_MAX=60` (проект/тема/привычка; в `canSave(title, max)` передавать 60).
- CloudStorage читается пачками по 100 (`getKeys`+`getItems`); `cloudKV.set/remove` бросает при `ok===false`.
- `createKV()`: CloudStorage только при непустом `initData` и Bot API ≥ 6.9; иначе localStorage с префиксом `kv:`; иначе память. telegram-web-app.js создаёт `WebApp` и в браузере — признак Telegram только `initData`.
- Вне облака App показывает OutsideBanner; вызовы `tg.*` вне Telegram — no-op.
- Снимок `tasks_snapshot_v1` в localStorage для мгновенного старта + `dirty` (неподтверждённые записи) — дописываются при следующем `load()` и важнее облачных значений.
- Сбои облака: повторы с паузой `retryDelayMs*(попытка)`; на серию — одно `ERR_RETRY` и одно `ERR_GAVE_UP`; после отказа запись остаётся в dirty.
- «Входящие» (`inbox: true`) неудаляемы (`removeProject` → false), создаются при загрузке, дубли схлопываются; задача без валидного `projectId` уходит во Входящие.
- Журнал активности (`state.activity`, нули не хранятся) двигает только внутренний `bumpActivity`: `toggleDone` +1, снятие −1 лишь в тот же день; `toggleHabit` ±1. Удаление задач/привычек журнал не трогает.
- `prepareJournal` в `load()`: `firstDay` = min `createdAt` или сегодня; разовая миграция done-задач по флагу `activityMigrated` ставит max(журнал, подсчёт) — повтор не удваивает; при ERR_LOAD (offline) ни миграции, ни записи meta.
- Привычки: `days` — 0=пн…6=вс (`ALL_DAYS`); дни недели и месяцы брать только из `src/dates/index.ts` (activity.ts/habits.ts их реэкспортируют).
- Любое удаление подтверждается через `useConfirm()` (`src/ui/hooks/useConfirm.ts`, второе касание за `CONFIRM_MS=3000`) — своё не заводить.
- Салют закрытия проекта — один глобальный `<ProjectCelebration/>` в App (через `completedProjects` из model.ts); из экранов `confetti()` не вызывать. Мелкий всплеск — `<Burst size?>`.
- Новый вложенный экран: вариант в `Route` (nav.tsx) + ветка в `NestedScreen` (App.tsx). Формы-шторки — на `useSheetSession<T>()`.
- `tg.backButton` держит один обработчик; ставит его только NavProvider. Открытая `Sheet` через `useBackCloses` перехватывает BackButton раньше экрана (порядок — `backAction` в `src/ui/navModel.ts`).
- `vite.config.ts`: `base: './'` — сборка открывается из подпапки GitHub Pages; не менять на абсолютный путь.
- Деплой — на push в `main` (локальная ветка тоже `main`); токен бота не нужен.
- Тесты (среда `node`, только `src/**/*.test.ts`): store и привычки поверх `memoryKV` (`snapshot: null`) — включая журнал, миграцию, ошибки облака, лимит; `cloudKV` при отказе; dates/activity/habits; `form.ts`; `confirm.ts`; `navModel.ts`; `screens/model.ts`. Компоненты не тестируются — проверка сборкой и в браузере.
- Цвет фона `#0B0B12` продублирован: `APP_BG` в `src/tg/index.ts`, `theme-color` в `index.html`, `--bg` в `src/ui/styles/tokens.css`.

## Как здесь работает Autopilot

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Правило: требование из `manifest.md`
может снять только пользователь.

Если работа продолжается — скажи «продолжи автопилот»: состояние поднимется
из `.autopilot/state.js`, переспрашивать ничего не нужно.
<!-- autopilot:end -->
