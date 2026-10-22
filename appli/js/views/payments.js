// Suivi des paiements : factures payées, à payer, en retard, avec filtres et aide URSSAF.

import { store } from '../store.js';
import { esc, euros, dateFR, todayISO } from '../util.js';
import { icon, entete, pill } from '../ui.js';
import { invoiceStatus, isInvoiceKind } from '../legal.js';
import { encaisse, urssafPeriod } from '../reminders.js';

export function render(el, params, query = {}) {
  const f = query.f || 'attente';
  const invoices = store.all('documents').filter((d) => isInvoiceKind(d.kind) && d.number).map((d) => ({ d, st: invoiceStatus(d) }));
  const groups = {
    attente: invoices.filter((x) => ['a_payer', 'partiel'].includes(x.st.code)),
    retard: invoices.filter((x) => x.st.code === 'en_retard'),
    payees: invoices.filter((x) => x.st.code === 'payee'),
  };
  const sum = (arr, k = 'remaining') => arr.reduce((s, x) => s + x.st[k], 0);
  const list = (groups[f] || []).sort((a, b) => String(a.d.dueDate).localeCompare(String(b.d.dueDate)));
  const today = todayISO();
  const month = today.slice(0, 7);
  const period = urssafPeriod(today);
  const recent = store.all('payments').slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  el.innerHTML = `<div class="pile">
    ${entete('Paiements', { retour: { href: '#/plus', label: 'Plus' } })}
    <div class="grille-2">
      <div class="kpi"><span class="libelle">Encaissé ce mois</span><span class="valeur montant">${euros(encaisse(`${month}-01`, `${month}-31`))}</span></div>
      <div class="kpi"><span class="libelle">À encaisser</span><span class="valeur montant">${euros(sum(groups.attente) + sum(groups.retard))}</span></div>
    </div>
    ${period ? `<a class="carte-framboise pile" href="#/taches" style="text-decoration:none;gap:2px">
        <span class="tres-petit" style="letter-spacing:.15em;text-transform:uppercase;opacity:.9">À déclarer à l'URSSAF</span>
        <span style="font-size:24px;font-weight:500" class="montant">${euros(encaisse(period.from, period.to))}</span>
        <span class="petit">Encaissé en ${esc(period.label)} · avant le ${esc(dateFR(period.deadline))}</span></a>` : ''}
    <div class="seg" role="tablist">
      <a role="tab" href="#/paiements?f=attente" class="${f === 'attente' ? 'actif' : ''}">À payer (${groups.attente.length})</a>
      <a role="tab" href="#/paiements?f=retard" class="${f === 'retard' ? 'actif' : ''}">En retard (${groups.retard.length})</a>
      <a role="tab" href="#/paiements?f=payees" class="${f === 'payees' ? 'actif' : ''}">Payées</a>
    </div>
    <div class="entre petit"><span class="doux">${list.length} facture${list.length > 1 ? 's' : ''}</span><span class="gras montant">${euros(f === 'payees' ? sum(list, 'paid') : sum(list))}</span></div>
    <div class="liste">${list.map(({ d, st }) => `<a class="element" href="#/document/${d.id}"><span class="grandit">
        <span class="titre">${esc(d.clientSnapshot?.name || '')}</span>
        <span class="detail">${esc(d.number)} · échéance ${esc(dateFR(d.dueDate))}</span></span>
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="montant gras" style="font-size:15px">${euros(f === 'payees' ? st.paid : st.remaining)}</span>${pill(st)}</span></a>`).join('') || '<div class="vide">Rien ici.</div>'}</div>
    ${recent.length ? `<span class="etiquette">Derniers paiements reçus</span><div class="liste">${recent.map((p) => {
      const d = store.get('documents', p.documentId);
      return `<a class="element" href="#/document/${p.documentId}"><span class="grandit"><span class="titre">${esc(d?.clientSnapshot?.name || '')}</span><span class="detail">${esc(dateFR(p.date))} · ${esc(p.method)} · ${esc(d?.number || '')}</span></span><span class="montant gras" style="color:var(--vert)">+ ${euros(p.amountCents)}</span></a>`;
    }).join('')}</div>` : ''}
    <p class="tres-petit doux">${icon('alert', 14)} Le montant URSSAF correspond aux sommes encaissées (date du paiement), comme le prévoit la micro-entreprise. Vérifiez-le avant de déclarer.</p>
  </div>`;
}
