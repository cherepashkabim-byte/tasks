import { render } from 'preact';
import { createKV, isTelegramStorage } from './kv';
import { createStore } from './store';
import { tg } from './tg';
import { App } from './ui/App';
import './ui/styles/index.css';

tg.ready();
if (tg.isTelegram) document.documentElement.classList.add('in-telegram');

const store = createStore(createKV());
render(<App store={store} cloud={isTelegramStorage()} />, document.getElementById('app')!);
void store.load();
