import { useEffect } from 'preact/hooks';
import type { Store } from '../store';
import { Background } from './components/Background';
import { Fab } from './components/Fab';
import { OutsideBanner } from './components/OutsideBanner';
import { ProjectCelebration } from './components/Progress';
import { TabBar } from './components/TabBar';
import { NavProvider, useNav, type Route, type TabId } from './nav';
import { EditorProvider } from './editor/TaskEditor';
import { DueScreen } from './screens/DueScreen';
import { HabitForm } from './screens/forms';
import { HabitFormProvider } from './sheets/habitForm';
import { HabitsScreen } from './screens/HabitsScreen';
import { ProjectScreen } from './screens/ProjectScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { ThemeScreen } from './screens/ThemeScreen';
import { ThemesScreen } from './screens/ThemesScreen';
import { StoreProvider, useStore } from './StoreContext';
import { ToastProvider, useToast } from './toast';

const TAB_SCREENS: Record<TabId, () => preact.JSX.Element> = {
  due: DueScreen,
  projects: ProjectsScreen,
  themes: ThemesScreen,
  habits: HabitsScreen,
};

function NestedScreen({ route }: { route: Route }) {
  switch (route.name) {
    case 'project':
      return <ProjectScreen id={route.id} />;
    case 'theme':
      return <ThemeScreen id={route.id} />;
  }
}

/** Ошибки записи стора → тост. */
function StoreErrors() {
  const store = useStore();
  const toast = useToast();
  useEffect(() => store.onError((text) => toast.show({ text, tone: 'danger', duration: 4000 })), [store, toast]);
  return null;
}

function Shell({ cloud }: { cloud: boolean }) {
  const nav = useNav();
  const TabScreen = TAB_SCREENS[nav.tab];
  // key заставляет экран перемонтироваться → срабатывает анимация появления.
  const screenKey = nav.current ? `${nav.current.name}:${nav.current.id}` : nav.tab;
  return (
    <div class="app">
      <Background />
      <main class="app__content" key={screenKey}>
        {nav.current ? <NestedScreen route={nav.current} /> : <TabScreen />}
      </main>
      <div class="app__bottom">
        <Fab />
        {!cloud && <OutsideBanner />}
        <TabBar />
      </div>
    </div>
  );
}

export function App({ store, cloud }: { store: Store; cloud: boolean }) {
  return (
    <StoreProvider store={store}>
      <ToastProvider>
        <NavProvider>
          <EditorProvider>
            <HabitFormProvider form={HabitForm}>
              <StoreErrors />
              <ProjectCelebration />
              <Shell cloud={cloud} />
            </HabitFormProvider>
          </EditorProvider>
        </NavProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
