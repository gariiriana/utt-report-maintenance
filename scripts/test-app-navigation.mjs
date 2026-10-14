import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import {
  updateNavigation, flushNavigation, setMenuPath, readFolderPath, writeFolderPath,
  subscribeNavigation, readNavigationValue, writeNavigationValue,
} from '../frontend/utils/appNavigation.ts';

function browserMock(path = '/management-file') {
  const target = new EventTarget();
  const entries = [{ url: `https://dwimitrasystem.com${path}`, state: { unrelated: 'preserved' } }];
  let index = 0;
  const location = { href: entries[0].url };
  return {
    location, addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target),
    history: {
      get length() { return entries.length; },
      get state() { return entries[index].state; },
      pushState(state, _, url) {
        entries.splice(++index); entries.push({ url: String(url), state }); location.href = String(url);
      },
      replaceState(state, _, url) {
        entries[index] = { url: String(url), state }; location.href = String(url);
      },
      go(offset) {
        index += offset; assert.ok(index >= 0 && index < entries.length);
        location.href = entries[index].url;
        const event = new Event('popstate'); event.state = entries[index].state;
        target.dispatchEvent(event);
      },
    },
  };
}

beforeEach(() => { flushNavigation(); globalThis.window = browserMock(); });
const labels = ['Risk Register', 'Cooling Tower', 'Q3', 'Form SLA/SLG'];
const url = () => new URL(window.location.href);

test('folder clicks create separate Back/Forward entries; popstate creates no entries', () => {
  let updates = 0;
  const unsubscribe = subscribeNavigation(() => updates++);
  for (const [index, folder] of [[1, 'Risk Register'], [2, 'Q3'], [3, 'Cooling Tower']]) {
    updateNavigation(draft => writeFolderPath(draft, index, folder, labels)); flushNavigation();
  }
  assert.equal(url().pathname, '/management-file/risk-register/q3/cooling-tower');
  assert.equal(window.history.length, 4);
  window.history.go(-1);
  assert.equal(url().pathname, '/management-file/risk-register/q3');
  window.history.go(-1);
  assert.equal(url().pathname, '/management-file/risk-register');
  window.history.go(1); window.history.go(1);
  assert.equal(readFolderPath(3, labels), 'Cooling Tower');
  assert.equal(window.history.length, 4); assert.equal(updates, 7);
  unsubscribe();
});

// Exercise the actual PWA guard in Node; no browser, Firebase or DOM dependencies.
const guardBundle = await build({
  entryPoints: [fileURLToPath(new URL('../frontend/utils/pwaBackGuard.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', plugins: [{
    name: 'navigation-test-dependencies', setup(builder) {
      builder.onResolve({ filter: /^(sonner|@\/utils\/modalScrollLock)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'sonner'
        ? 'export const toast = { info: (message) => globalThis.guardMessages.push(message), dismiss: () => {} };'
        : 'export const hasActiveModalsInDOM = () => globalThis.guardModalOpen; export const isModalOverlayElement = () => false;' }));
      builder.onResolve({ filter: /^@\/utils\/appNavigation$/ }, () => ({ path: fileURLToPath(new URL('../frontend/utils/appNavigation.ts', import.meta.url)) }));
    },
  }],
});
const { initPwaBackGuard } = await import('data:text/javascript;base64,' + Buffer.from(guardBundle.outputFiles[0].text).toString('base64'));

function guardEnvironment() {
  globalThis.guardMessages = []; globalThis.guardModalOpen = false;
  globalThis.document = { querySelectorAll: () => [], dispatchEvent: () => { globalThis.guardModalOpen = false; } };
  globalThis.KeyboardEvent = class extends Event {};
  const timers = new Map(); let nextId = 0;
  window.setTimeout = callback => { timers.set(++nextId, callback); return nextId; };
  window.clearTimeout = id => timers.delete(id);
  return { timers };
}

test('PWA Back and Forward traverse real folders without inserting guards or exit hints', t => {
  guardEnvironment(); const cleanup = initPwaBackGuard(); t.after(cleanup);
  for (const [index, folder] of [[1, 'Risk Register'], [2, 'Q3'], [3, 'Cooling Tower']]) {
    updateNavigation(draft => writeFolderPath(draft, index, folder, labels)); flushNavigation();
  }
  const length = window.history.length;
  window.history.go(-1); assert.equal(url().pathname, '/management-file/risk-register/q3');
  window.history.go(1); assert.equal(readFolderPath(3, labels), 'Cooling Tower');
  assert.equal(window.history.length, length); assert.deepEqual(guardMessages, []);
});

test('reinitializing the PWA guard on a routed entry does not create a duplicate after refresh', t => {
  guardEnvironment(); let cleanup = initPwaBackGuard();
  updateNavigation(draft => writeFolderPath(draft, 1, 'Risk Register', labels)); flushNavigation();
  const length = window.history.length;
  cleanup(); cleanup = initPwaBackGuard(); t.after(cleanup);
  assert.equal(window.history.length, length);
  window.history.go(-1); assert.equal(url().pathname, '/management-file');
});

test('PWA Back with a popup closes it and restores the current route without losing Forward', t => {
  guardEnvironment(); const cleanup = initPwaBackGuard(); t.after(cleanup);
  updateNavigation(draft => writeFolderPath(draft, 1, 'Risk Register', labels)); flushNavigation();
  updateNavigation(draft => writeFolderPath(draft, 2, 'Q3', labels)); flushNavigation();
  const length = window.history.length; globalThis.guardModalOpen = true;
  window.history.go(-1);
  assert.equal(guardModalOpen, false); assert.equal(readFolderPath(2, labels), 'Q3');
  assert.equal(window.history.length, length);
  window.history.go(-1); assert.equal(readFolderPath(2, labels), null);
  window.history.go(1); assert.equal(readFolderPath(2, labels), 'Q3');
});

test('PWA exit hint occurs only at the session boundary and survives URL normalization', t => {
  window = browserMock('/'); const { timers } = guardEnvironment();
  const cleanup = initPwaBackGuard(); t.after(cleanup);
  updateNavigation(draft => setMenuPath(draft, 'dashboard'), true); flushNavigation();
  window.history.go(-1);
  assert.equal(guardMessages.length, 1); assert.equal(window.history.state.dwimitraBackBoundary, true);
  updateNavigation(draft => setMenuPath(draft, 'dashboard'), true); flushNavigation();
  assert.equal(window.history.state.dwimitraBackBoundary, true); assert.equal(timers.size, 1);
  for (const callback of [...timers.values()]) callback();
  assert.equal(window.history.state.dwimitraBackGuard, true);
  updateNavigation(draft => setMenuPath(draft, 'management-file')); flushNavigation();
  assert.equal(window.history.state.dwimitraBackBoundary, undefined);
});

test('one breadcrumb interaction batches resets into one history entry', () => {
  window = browserMock('/management-file/risk-register/q3/cooling-tower');
  updateNavigation(draft => writeFolderPath(draft, 1, null, labels));
  updateNavigation(draft => writeFolderPath(draft, 2, null, labels));
  updateNavigation(draft => writeFolderPath(draft, 3, null, labels));
  flushNavigation();
  assert.equal(url().pathname, '/management-file'); assert.equal(window.history.length, 2);
  window.history.go(-1); assert.equal(readFolderPath(3, labels), 'Cooling Tower');
});

test('direct links decode known slugs and arbitrary Unicode/slash folder names', () => {
  const draft = url(); writeFolderPath(draft, 1, 'Form SLA/SLG', labels);
  assert.equal(readFolderPath(1, labels, draft), 'Form SLA/SLG');
  const custom = 'Ruang 日本 / #1?'; writeFolderPath(draft, 1, custom, labels);
  assert.equal(readFolderPath(1, labels, draft), custom);
});

test('changing menus clears nested navigation while preserving external query parameters', () => {
  window = browserMock('/management-file/risk-register/q3?nav.week=4&campaign=abc');
  updateNavigation(draft => setMenuPath(draft, 'ptw')); flushNavigation();
  assert.equal(url().pathname, '/ptw'); assert.equal(url().search, '?campaign=abc');
  assert.equal(window.history.state.unrelated, 'preserved');
});

test('clicking the current location adds no history entry and preserves Forward', () => {
  updateNavigation(draft => writeFolderPath(draft, 1, 'Risk Register', labels)); flushNavigation();
  window.history.go(-1);
  updateNavigation(draft => writeFolderPath(draft, 1, null, labels)); flushNavigation();
  assert.equal(window.history.length, 2);
  window.history.go(1); assert.equal(readFolderPath(1, labels), 'Risk Register');
});

test('popstate cancels queued updates, and outgoing animated pages cannot alter another menu', () => {
  const unsubscribe = subscribeNavigation(() => {});
  updateNavigation(draft => setMenuPath(draft, 'ptw')); flushNavigation();
  updateNavigation(draft => writeNavigationValue(draft, 'tab', 'weekly'));
  window.history.go(-1); flushNavigation();
  assert.equal(url().pathname, '/management-file'); assert.equal(url().search, '');
  updateNavigation(draft => writeNavigationValue(draft, 'tab', 'weekly'), false, 'ptw'); flushNavigation();
  assert.equal(url().search, ''); unsubscribe();
});

test('PWA guard marker stays on replace but is excluded from real navigation entries', () => {
  window.history.replaceState({ dwimitraBackGuard: true, unrelated: 'preserved' }, '', window.location.href);
  updateNavigation(draft => setMenuPath(draft, 'dashboard'), true); flushNavigation();
  assert.equal(window.history.state.dwimitraBackGuard, true);
  updateNavigation(draft => setMenuPath(draft, 'management-file')); flushNavigation();
  assert.equal(window.history.state.dwimitraBackGuard, undefined);
  assert.equal(window.history.state.dwimitraNavigationIndex, 1);
  assert.equal(window.history.state.unrelated, 'preserved');
});

test('typed query navigation restores numbers/booleans and rejects unknown enum values', () => {
  const draft = url();
  writeNavigationValue(draft, 'week', 3);
  assert.equal(readNavigationValue(draft, 'week', null, [1, 2, 3, 4, 5, null]), 3);
  writeNavigationValue(draft, 'open', true);
  assert.equal(readNavigationValue(draft, 'open', false), true);
  writeNavigationValue(draft, 'tab', 'invalid');
  assert.equal(readNavigationValue(draft, 'tab', 'sop', ['sop', 'eop']), 'sop');
  writeNavigationValue(draft, 'tab', 'sop', 'sop');
  assert.equal(draft.searchParams.has('nav.tab'), false);
});
