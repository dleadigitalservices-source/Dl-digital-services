// Accueil « Ma journée » : prochain rendez-vous, 3 priorités, alertes, chiffres clés.

import { store } from '../store.js';
import { esc, euros, todayISO, dateLongue, heure, addDays } from '../util.js';
import { icon } from '../ui.js';
import { invoiceStatus, quoteStatus, quoteValidUntil, isInvoiceKind } from '../legal.js';
import { encaisse } from '../reminders.js';
import { taskRow, bindTaskRows, sortTasks } from './tasks.js';

export function render(el) {
  const s = store.settings;
  const today = todayISO();
  const nowDT = new Date().toISOString();
  const prenom = s.firstName && !s.firstName.startsWith('[') ? s.firstName : 'Léa';

  const events = store.all('events').filter((e) => e.start.slice(0, 10) === today).sort((a, b) => a.start.localeCompare(b.start));
  const nowLocal = new Date();
  const next = events.find((e) => new Date(e.start).getTime() + (e.durationMin || 30) * 60000 > nowLocal.getTime());
  const pubs = events.filter((e) => e.type === 'publication');

  const todo = sortTasks(store.all('tasks').filter((t) => !t.done && (!t.dueDate || t.dueDate <= today)));
  const doneToday = store.all('tasks').filter((t) => t.done && t.doneAt && t.doneAt.slice(0, 10) === today);
  const priorities = todo.slice(0, 3);

  const docs = store.all('documents');
  const invoices = docs.filter((d) => isInvoiceKind(d.kind) && d.number);
  const statuses = invoices.map((d) => ({ d, st: invoiceStatus(d) }));
  const late = statuses.filter((x) => x.st.code === 'en_retard');
  const pending = statuses.filter((x) => ['a_payer', 'partiel', 'en_retard'].includes(x.st.code)).reduce((sum, x) => sum + x.st.remaining, 0);
  const quotesOpen = docs.filter((d) => d.kind === 'quote' && quoteStatus(d).code === 'envoye');
  const expiring = quotesOpen.filter((d) => quoteValidUntil(d) <= addDays(today, 5));
  const drafts = docs.filter((d) => d.kind !== 'quote' && !d.number);
  const month = today.slice(0, 7);
  const cashMonth = encaisse(`${month}-01`, `${month}-31`);
  const cashYear = encaisse(`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`);
  const nbClients = store.all('clients').filter((c) => !c.archived).length;

  const minutesTo = next ? Math.round((new Date(next.start) - nowLocal) / 60000) : 0;
  const quand = next ? (minutesTo <= 0 ? 'en cours' : minutesTo < 60 ? `dans ${minutesTo} min` : `dans ${Math.floor(minutesTo / 60)} h${minutesTo % 60 ? String(minutesTo % 60).padStart(2, '0') : ''}`) : '';
  const clientOf = (id) => store.get('clients', id)?.name || '';

  const alerts = [];
  for (const { d, st } of late) alerts.push({ text: `${d.number} en retard`, detail: `${d.clientSnapshot?.name || ''} · ${euros(st.remaining)}`, href: `#/document/${d.id}`, action: 'Relancer' });
  for (const d of expiring) alerts.push({ text: `Devis ${d.number} bientôt expiré`, detail: `${d.clientSnapshot?.name || ''} · fin le ${quoteValidUntil(d).split('-').reverse().join('/')}`, href: `#/document/${d.id}`, action: 'Voir', soft: true });
  for (const d of drafts) alerts.push({ text: `${d.kind === 'balance' ? 'Facture de solde' : 'Facture'} en brouillon`, detail: d.clientSnapshot?.name || 'À finaliser', href: `#/edition/${d.id}`, action: 'Finaliser', soft: true });

  el.innerHTML = `
  <div class="pile">
    <div class="entre">
      <div><div class="sous-titre">${esc(dateLongue(today))}</div><h1>Bonjour <span class="accent">${esc(prenom)}</span></h1></div>
      <a class="icone-btn" href="#/taches" aria-label="Tâches et rappels">${icon('bell', 22)}</a>
    </div>

    <section class="carte pile" aria-labelledby="t-journee">
      <div class="entre"><h2 id="t-journee">Ma journée</h2><a class="petit" href="#/agenda">Voir l'agenda</a></div>
      ${next ? `<a class="carte-framboise ligne" href="#/agenda" style="text-decoration:none">
          <div style="display:flex;flex-direction:column;align-items:center;min-width:56px"><span style="font-size:20px;font-weight:500">${heure(next.start)}</span><span class="tres-petit" style="opacity:.9">${quand}</span></div>
          <div><span style="display:block;font-weight:500">${esc(next.title)}</span><span class="petit" style="opacity:.92">${esc([clientOf(next.clientId), next.place].filter(Boolean).join(' · '))}</span></div></a>`
        : `<div class="carte-voile petit">Plus de rendez-vous aujourd'hui.</div>`}
      ${pubs.length ? `<div class="petit doux">${pubs.length} publication${pubs.length > 1 ? 's' : ''} prévue${pubs.length > 1 ? 's' : ''} aujourd'hui.</div>` : ''}
      <div class="entre"><span class="etiquette">Mes 3 priorités</span>${doneToday.length ? `<span class="tres-petit doux">${doneToday.length} faite${doneToday.length > 1 ? 's' : ''} aujourd'hui</span>` : ''}</div>
      <div class="liste" id="prio">${priorities.length ? priorities.map((t) => taskRow(t, { compact: true })).join('') : '<div class="carte-voile petit">Rien d’urgent. Belle journée !</div>'}</div>
      ${todo.length > 3 ? `<a class="petit" href="#/taches">Voir les ${todo.length - 3} autres tâches</a>` : ''}
    </section>

    ${alerts.map((a) => `<a class="${a.soft ? 'carte-voile' : 'carte-alerte'} ligne" href="${a.href}" style="text-decoration:none;color:inherit">
        ${icon('alert', 22)}<div class="grandit"><span style="display:block;font-weight:500">${esc(a.text)}</span><span class="petit">${esc(a.detail)}</span></div>
        <span class="pastille ${a.soft ? 'p-rose' : 'p-framboise'}">${a.action}</span></a>`).join('')}

    <div class="grille-2">
      <a class="kpi" href="#/paiements"><span class="libelle">Encaissé ce mois</span><span class="valeur montant">${euros(cashMonth)}</span></a>
      <a class="kpi" href="#/paiements"><span class="libelle">En attente</span><span class="valeur montant">${euros(pending)}</span></a>
      <a class="kpi" href="#/devis"><span class="libelle">Devis en cours</span><span class="valeur">${quotesOpen.length}</span></a>
      <a class="kpi" href="#/clients"><span class="libelle">Clients</span><span class="valeur">${nbClients}</span></a>
    </div>
    <div class="carte-voile entre petit"><span>Encaissé depuis janvier</span><span class="gras montant">${euros(cashYear)}</span></div>

    <a class="btn plein" href="#/edition/nouveau?type=invoice">${icon('plus', 20)} Nouvelle facture</a>
  </div>`;

  bindTaskRows(el.querySelector('#prio'), () => render(el));
}
