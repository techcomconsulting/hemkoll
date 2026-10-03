// Startpunkten: inloggning, sidor, flikar och meny.
import { isConfigured, auth, onAuthStateChanged } from './firebase.js';
import { getProfile, loadSpaces, loadInvites, prefetch, onDataChange } from './data.js';
import { icon, esc } from './ui.js';
import './install.js';
import { loginView, registerView, forgotView } from './views/auth.js';
import { homeView } from './views/home.js';
import { binderView, docView } from './views/binder.js';
import { remindersView } from './views/reminders.js';
import { budgetView } from './views/budget.js';
import { moreView, spaceView } from './views/more.js';
import { openAddMenu } from './views/add.js';
import { loansView } from './views/loans.js';
import { timelineView, eventView, shareView, PENDING_IMPORT } from './views/timeline.js';

const root = document.getElementById('app');
const nav = document.getElementById('nav');

export const state = { user: null, profile: null, spaces: [], invites: [], spaceId: null, registering: false };

const PUBLIC = ['/login', '/registrera', '/glomt'];
// Sidor som alla kan öppna, inloggad eller inte.
const OPEN = /^\/delning\/[^/]+$/;

const routes = [
  [/^\/login$/, loginView, null],
  [/^\/registrera$/, registerView, null],
  [/^\/glomt$/, forgotView, null],
  [/^\/$/, homeView, 'home'],
  [/^\/parm$/, binderView, 'binder'],
  [/^\/parm\/([^/]+)$/, docView, 'binder'],
  [/^\/paminnelser$/, remindersView, 'home'],
  [/^\/tidslinje$/, timelineView, 'more'],
  [/^\/tidslinje\/([^/]+)$/, eventView, 'more'],
  [/^\/delning\/([^/]+)$/, shareView, null],
  [/^\/lan$/, loansView, 'more'],
  [/^\/budget$/, budgetView, 'budget'],
  [/^\/mer$/, moreView, 'more'],
  [/^\/flik\/([^/]+)$/, spaceView, 'more']
];

export const ctx = {
  state,
  go: (path) => { if (location.hash === '#' + path) route(); else location.hash = '#' + path; },
  rerender: () => route(true),
  space: () => state.spaces.find((s) => s.id === state.spaceId) || state.spaces[0] || null,
  setSpace: (id) => {
    state.spaceId = id;
    try { localStorage.setItem('hk-space', id); } catch { /* ok */ }
    prefetch(state.user.uid, id);
    route();
  },
  reloadSpaces: async (waitInvites = true) => {
    const inv = loadInvites(state.user.uid).then((invites) => {
      const changed = invites.length !== state.invites.length;
      state.invites = invites;
      if (changed && !waitInvites) softRender();
    });
    state.spaces = await loadSpaces(state.user.uid);
    if (!state.spaces.some((s) => s.id === state.spaceId)) state.spaceId = state.spaces[0]?.id || null;
    if (waitInvites) await inv;
  },
  reloadProfile: async () => { state.profile = await getProfile(state.user.uid); },
  startSession: null
};

// Flikväljaren högst upp på sidorna.
export function spaceBar() {
  if (state.spaces.length < 2) return '';
  return `<div class="pills" role="group" aria-label="Välj flik" style="margin:-4px 0 0">
    ${state.spaces.map((s) => `<button type="button" data-space="${s.id}" aria-pressed="${s.id === state.spaceId}">${s.personal ? icon('lock', 14, 2) + ' ' : ''}${esc(s.name)}</button>`).join('')}
  </div>`;
}
export function wireSpaceBar(el) {
  el.querySelectorAll('[data-space]').forEach((b) => b.addEventListener('click', () => ctx.setSpace(b.dataset.space)));
}
ctx.spaceBar = spaceBar;
ctx.wireSpaceBar = wireSpaceBar;

function renderNav(active) {
  if (!active) { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');
  const item = (key, href, ic, label) =>
    `<a href="${href}" ${key === active ? 'aria-current="page"' : ''}><span class="ic">${icon(ic, 24)}</span><span>${label}</span></a>`;
  nav.innerHTML = `<div class="nav-inner">
    ${item('home', '#/', 'home', 'Översikt')}
    ${item('binder', '#/parm', 'folder', 'Pärm')}
    <a href="#" class="mat" data-add><span class="plus">${icon('plus', 22, 2.2)}</span><span>Lägg till</span></a>
    ${item('budget', '#/budget', 'wallet', 'Budget')}
    ${item('more', '#/mer', 'grid', 'Mer')}
  </div>`;
  nav.querySelector('[data-add]').addEventListener('click', (e) => { e.preventDefault(); openAddMenu(ctx); });
}

// Ny data kom i bakgrunden: rita om sidan utan att hoppa upp.
let softTimer;
function softRender() {
  clearTimeout(softTimer);
  softTimer = setTimeout(async () => {
    if (!state.user || document.querySelector('.sheet-backdrop')) return;
    const a = document.activeElement;
    if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) return;
    if (state.user) state.spaces = await loadSpaces(state.user.uid).catch(() => state.spaces);
    route(true);
  }, 300);
}
onDataChange(softRender);

let routing = 0;
async function route(keepScroll = false) {
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const open = OPEN.test(path);
  if (!state.user && !PUBLIC.includes(path) && !open) { location.hash = '#/login'; return; }
  if (state.user && PUBLIC.includes(path)) { location.hash = '#/'; return; }
  // Kom personen från en delad länk? Gå tillbaka dit efter inloggning.
  if (state.user && state.profile && !open) {
    let t = null;
    try { t = localStorage.getItem(PENDING_IMPORT); localStorage.removeItem(PENDING_IMPORT); } catch { /* ok */ }
    if (t) { location.hash = '#/delning/' + t; return; }
  }
  const found = routes.find(([re]) => re.test(path));
  if (!found) { location.hash = '#/'; return; }
  const [re, view, active] = found;
  const params = path.match(re).slice(1).map(decodeURIComponent);
  const my = ++routing;
  renderNav(state.user ? active : null);
  const y = window.scrollY;
  const slow = keepScroll ? null : setTimeout(() => { if (my === routing) root.innerHTML = '<div class="boot">Laddar…</div>'; }, 350);
  try {
    const html = document.createElement('div');
    await view(html, ctx, ...params);
    clearTimeout(slow);
    if (my !== routing) return;
    root.replaceChildren(html);
    window.scrollTo(0, keepScroll ? y : 0);
  } catch (e) {
    clearTimeout(slow);
    console.error(e);
    if (my !== routing) return;
    root.innerHTML = `<div class="screen"><h1>Hoppsan</h1><p class="muted">Sidan kunde inte laddas. Kontrollera internet och försök igen.</p><a class="btn primary" href="#/">Till översikten</a></div>`;
  }
}

async function startSession(user) {
  try { state.spaceId = localStorage.getItem('hk-space'); } catch { /* ok */ }
  const [profile] = await Promise.all([
    getProfile(user.uid, true).catch(() => null),
    ctx.reloadSpaces(false).catch(() => {})
  ]);
  state.profile = profile;
  prefetch(user.uid, state.spaceId);
}
ctx.startSession = startSession;

if (!isConfigured) {
  root.innerHTML = `<div class="screen no-nav"><h1>Nästan klart!</h1>
    <div class="banner soft">Appen är inte kopplad till Firebase än.</div>
    <p>Öppna filen <b>js/config.js</b> och klistra in dina Firebase-uppgifter.</p></div>`;
} else {
  window.addEventListener('hashchange', () => { document.querySelectorAll('.sheet-backdrop').forEach((x) => x.remove()); route(); });
  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (state.registering) return;
    if (user) await startSession(user);
    else { state.profile = null; state.spaces = []; state.invites = []; }
    route();
  });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
