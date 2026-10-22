// Point d'entrée : démarrage, connexion, navigation entre les écrans.

import { store } from './store.js';
import { INACTIVITY_MINUTES } from './config.js';
import { demoData, catalogueDepart } from './demo.js';
import { icon, toast, closeSheet } from './ui.js';
import { esc } from './util.js';
import * as home from './views/home.js';
import * as agenda from './views/agenda.js';
import * as clients from './views/clients.js';
import * as documents from './views/documents.js';
import * as payments from './views/payments.js';
import * as tasks from './views/tasks.js';
import * as services from './views/services.js';
import * as settings from './views/settings.js';
import * as more from './views/more.js';
import * as login from './views/login.js';
import { startReminders, runAutoTasks } from './reminders.js';

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const fab = document.getElementById('fab');
const banner = document.getElementById('demo-banner');

const ROUTES = {
  accueil: { render: home.render, tab: 'accueil' },
  agenda: { render: agenda.render, tab: 'agenda', fab: true },
  clients: { render: clients.renderList, tab: 'clients', fab: true },
  client: { render: clients.renderDetail, tab: 'clients' },
  'client-edition': { render: clients.renderEdit, tab: 'clients', noTabbar: true },
  factures: { render: (el, p, q) => documents.renderList(el, 'factures', q), tab: 'factures', fab: true },
  devis: { render: (el, p, q) => documents.renderList(el, 'devis', q), tab: 'factures', fab: true },
  avoirs: { render: (el, p, q) => documents.renderList(el, 'avoirs', q), tab: 'factures', fab: true },
  document: { render: documents.renderDetail, tab: 'factures' },
  edition: { render: documents.renderEditor, tab: 'factures', noTabbar: true },
  apercu: { render: documents.renderPreview, tab: 'factures', noTabbar: true },
  paiements: { render: payments.render, tab: 'plus' },
  taches: { render: tasks.render, tab: 'plus', fab: true },
  prestations: { render: services.renderServices, tab: 'plus' },
  modeles: { render: services.renderTemplates, tab: 'plus' },
  reglages: { render: settings.render, tab: 'plus' },
  plus: { render: more.render, tab: 'plus' },
  creer: { render: more.renderCreate, tab: null },
};

const TABS = [
  ['accueil', 'Accueil', 'home'],
  ['agenda', 'Agenda', 'calendar'],
  ['clients', 'Clients', 'users'],
  ['factures', 'Factures', 'file'],
  ['plus', 'Plus', 'menu'],
];

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const [name, ...params] = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { name: name || 'accueil', params, query };
}

let lastTab = 'accueil';

function renderTabbar(active) {
  tabbar.innerHTML = TABS.map(([key, label, ic]) => `<a href="#/${key}" class="${key === active ? 'actif' : ''}" ${key === active ? 'aria-current="page"' : ''}>${icon(ic, 24)}${label}</a>`).join('');
}

export function navigate(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

export function route() {
  closeSheet();
  if (!store.state) return;
  const { name, params, query } = parseHash();
  let r = ROUTES[name];
  if (!r) { location.hash = '#/accueil'; return; }
  if (name === 'creer') { more.renderCreate(); history.replaceState(null, '', `#/${lastTab}`); r = ROUTES[lastTab]; }
  const tab = r.tab || lastTab;
  lastTab = tab;
  document.body.classList.toggle('no-tabbar', Boolean(r.noTabbar));
  tabbar.hidden = Boolean(r.noTabbar);
  fab.hidden = !r.fab || Boolean(r.noTabbar);
  fab.onclick = null; // chaque écran peut redéfinir l'action du bouton +
  renderTabbar(tab);
  banner.hidden = !store.isDemo || Boolean(r.noTabbar);
  try {
    r.render(view, params, query);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="carte-alerte">Une erreur est survenue sur cet écran. <a href="#/accueil">Retour à l'accueil</a><br><span class="tres-petit">${esc(err.message)}</span></div>`;
  }
  if (name !== 'creer') window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

function applyDisplayPrefs() {
  const s = store.settings;
  document.documentElement.classList.toggle('grand-texte', Boolean(s.bigText));
  document.documentElement.classList.toggle('police-dys', Boolean(s.dysFont));
}

// ---------- Déconnexion après inactivité (mode sécurisé) ----------
let inactivityTimer = null;
function armInactivity() {
  if (store.mode !== 'supabase') return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    await store.signOut();
    toast('Déconnectée après 15 minutes sans activité, pour protéger vos données.');
    showLogin();
  }, INACTIVITY_MINUTES * 60 * 1000);
}
['pointerdown', 'keydown', 'scroll'].forEach((ev) => window.addEventListener(ev, armInactivity, { passive: true }));

function showLogin() {
  tabbar.hidden = true; fab.hidden = true; banner.hidden = true;
  document.body.classList.add('no-tabbar');
  login.render(view, async () => { await startApp(true); });
}

async function startApp(secure) {
  await store.load(secure);
  if (!store.state.meta.seeded) {
    // Mode démo : exemples complets. Mode sécurisé : seulement le catalogue et les modèles.
    if (secure) {
      const { services, templates } = catalogueDepart();
      await store.replaceAll({ services, templates, counters: {}, meta: { demo: false, seeded: true } });
    } else {
      await store.replaceAll(demoData());
    }
  }
  applyDisplayPrefs();
  store.subscribe(applyDisplayPrefs);
  await runAutoTasks();
  startReminders();
  armInactivity();
  if (!location.hash || location.hash === '#/connexion') location.hash = '#/accueil';
  route();
}

window.addEventListener('hashchange', route);

async function boot() {
  try {
    if (store.secureAvailable) {
      const session = await store.initAuth();
      if (!session) { showLogin(); return; }
      await startApp(true);
    } else {
      await startApp(false);
    }
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="carte-alerte">Impossible de démarrer l'application : ${esc(err.message)}</div>`;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boot();
