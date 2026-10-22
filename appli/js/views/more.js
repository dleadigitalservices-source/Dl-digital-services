// Menu « Plus » et création rapide (bouton +).

import { store } from '../store.js';
import { esc, todayISO } from '../util.js';
import { icon, sheet } from '../ui.js';
import { navigate } from '../app.js';
import { openTaskEditor } from './tasks.js';
import { openEventEditor } from './agenda.js';

export function render(el) {
  const items = [
    ['#/devis', 'Devis', 'filePlus', 'Créer, envoyer, suivre les acceptations'],
    ['#/avoirs', 'Avoirs', 'undo', 'Corriger une facture finalisée'],
    ['#/paiements', 'Paiements', 'euro', 'À payer, en retard, encaissé, URSSAF'],
    ['#/taches', 'Tâches et rappels', 'task', 'Mes priorités du jour'],
    ['#/prestations', 'Prestations', 'tag', 'Catalogue et tarifs'],
    ['#/modeles', 'Modèles de devis', 'layers', 'Devis prêts en un clic'],
    ['#/reglages', 'Réglages', 'settings', 'Entreprise, mentions, CGV, sauvegarde'],
  ];
  el.innerHTML = `<div class="pile">
    <div class="entete"><h1>Plus</h1></div>
    <div class="liste">${items.map(([href, t, ic, d]) => `<a class="element" href="${href}"><span class="rond" style="width:42px;height:42px;border-radius:999px;background:var(--rose-poudre);color:var(--framboise);display:flex;align-items:center;justify-content:center;flex:0 0 auto">${icon(ic, 21)}</span>
      <span class="grandit"><span class="titre">${esc(t)}</span><span class="detail">${esc(d)}</span></span>${icon('chevron', 18)}</a>`).join('')}</div>
    <div style="text-align:center;margin-top:16px">
      <img src="icons/logo.png" alt="" width="64" height="64" style="opacity:.9">
      <div class="tres-petit doux" style="font-family:var(--titre);font-style:italic;font-size:14px;color:var(--framboise)">La petite main des grandes entreprises</div>
      <div class="tres-petit doux">Version 1 · ${store.mode === 'supabase' ? 'données sécurisées' : 'données sur cet appareil'}</div>
    </div>
  </div>`;
}

/** Bouton + : créer en un geste. */
export async function renderCreate() {
  const choice = await sheet({
    title: 'Créer',
    html: `<div class="grille-2">
      ${[['invoice', 'Facture', 'file'], ['quote', 'Devis', 'filePlus'], ['event', 'Rendez-vous', 'calendar'], ['task', 'Tâche', 'task'], ['client', 'Client', 'users']]
        .map(([k, l, ic]) => `<button type="button" class="carte" data-c="${k}" style="border:0;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;color:var(--framboise)">${icon(ic, 28)}<span style="color:var(--encre);font-size:16px">${l}</span></button>`).join('')}
    </div>`,
    bind: (root, close) => root.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => close(b.dataset.c))),
  });
  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  if (choice === 'invoice' || choice === 'quote') navigate(`#/edition/nouveau?type=${choice}`);
  if (choice === 'client') navigate('#/client-edition/nouveau');
  if (choice === 'event') openEventEditor(null, refresh, todayISO());
  if (choice === 'task') openTaskEditor(null, refresh);
}
