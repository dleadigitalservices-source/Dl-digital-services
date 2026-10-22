// Devis, factures, factures d'acompte et de solde, avoirs.
// Cycle : brouillon (modifiable, sans numéro) → finalisé (numéro attribué, figé).

import { store } from '../store.js';
import {
  esc, euros, uid, todayISO, addDays, dateFR, moisAnnee, norm, initiales,
  parseEuros, centsToInput, parseQty, qtyToText, lineTotal, percentOf, deepClone,
} from '../util.js';
import { icon, toast, sheet, confirmer, entete, champ, choix, zoneTexte, formData, pill, partagerTexte } from '../ui.js';
import {
  KIND_LABEL, UNITS, PAYMENT_METHODS, docTotals, docStatus, invoiceStatus, quoteStatus, isInvoiceKind,
  missingMentions, sellerSnapshot, clientSnapshot, defaultDueDate, paymentsFor, creditsFor, isPro,
} from '../legal.js';
import { docHTML, printDoc, fitDocs } from '../docrender.js';
import { templateToLines } from './services.js';
import { navigate } from '../app.js';

// ===========================================================================
// Liste
// ===========================================================================
export function renderList(el, type, query = {}) {
  const f = query.f || 'tous';
  const docs = store.all('documents');
  let list; let filtres = []; let resume = '';

  if (type === 'factures') {
    list = docs.filter((d) => isInvoiceKind(d.kind));
    filtres = [['tous', 'Toutes'], ['a_payer', 'À payer'], ['en_retard', 'En retard'], ['payee', 'Payées'], ['brouillon', 'Brouillons']];
    if (f !== 'tous') list = list.filter((d) => { const c = invoiceStatus(d).code; return f === 'a_payer' ? ['a_payer', 'partiel'].includes(c) : c === f; });
    const open = docs.filter((d) => isInvoiceKind(d.kind) && d.number).map(invoiceStatus);
    resume = `<div class="grille-2">
      <a class="kpi" href="#/factures?f=a_payer"><span class="libelle">Reste à encaisser</span><span class="valeur montant">${euros(open.reduce((s, x) => s + x.remaining, 0))}</span></a>
      <a class="kpi" href="#/factures?f=en_retard"><span class="libelle">En retard</span><span class="valeur montant" style="color:var(--rouge)">${euros(open.filter((x) => x.code === 'en_retard').reduce((s, x) => s + x.remaining, 0))}</span></a></div>`;
  } else if (type === 'devis') {
    list = docs.filter((d) => d.kind === 'quote');
    filtres = [['tous', 'Tous'], ['envoye', 'En cours'], ['accepte', 'Acceptés'], ['brouillon', 'Brouillons'], ['autres', 'Refusés / expirés']];
    if (f !== 'tous') list = list.filter((d) => { const c = quoteStatus(d).code; return f === 'autres' ? ['refuse', 'expire'].includes(c) : c === f; });
  } else {
    list = docs.filter((d) => d.kind === 'credit');
  }
  list.sort((a, b) => (b.number ? 0 : 1) - (a.number ? 0 : 1) || String(b.issueDate).localeCompare(String(a.issueDate)) || String(b.number).localeCompare(String(a.number)));
  const draftsFirst = list.filter((d) => !d.number).concat(list.filter((d) => d.number));

  const nouveau = type === 'devis' ? ['quote', 'Nouveau devis'] : type === 'factures' ? ['invoice', 'Nouvelle facture'] : null;

  el.innerHTML = `<div class="pile">
    <div class="entete"><div><h1>${type === 'devis' ? 'Devis' : type === 'avoirs' ? 'Avoirs' : 'Factures'}</h1></div></div>
    <div class="seg" role="tablist">
      <a role="tab" href="#/factures" class="${type === 'factures' ? 'actif' : ''}">Factures</a>
      <a role="tab" href="#/devis" class="${type === 'devis' ? 'actif' : ''}">Devis</a>
      <a role="tab" href="#/avoirs" class="${type === 'avoirs' ? 'actif' : ''}">Avoirs</a>
    </div>
    ${resume}
    ${filtres.length ? `<div class="ligne" style="flex-wrap:wrap;gap:6px">${filtres.map(([k, l]) => `<a href="#/${type}?f=${k}" class="pastille ${f === k ? 'p-framboise' : 'p-rose'}" style="text-decoration:none;font-size:13px;padding:7px 12px">${l}</a>`).join('')}</div>` : ''}
    <div class="liste">${draftsFirst.map(docRow).join('') || `<div class="vide">${type === 'avoirs' ? 'Aucun avoir. Un avoir se crée depuis une facture, en cas d’erreur.' : 'Rien à afficher ici.'}</div>`}</div>
    ${nouveau ? `<a class="btn plein secondaire" href="#/edition/nouveau?type=${nouveau[0]}">${icon('plus', 20)} ${nouveau[1]}</a>` : ''}
  </div>`;
  document.getElementById('fab').onclick = (e) => { e.preventDefault(); navigate(`#/edition/nouveau?type=${type === 'devis' ? 'quote' : 'invoice'}`); };
}

function docRow(d) {
  const st = docStatus(d);
  const t = docTotals(d);
  const amount = isInvoiceKind(d.kind) && d.number && ['partiel', 'en_retard'].includes(st.code) ? st.remaining : t.due;
  return `<a class="element" href="${d.number ? `#/document/${d.id}` : `#/edition/${d.id}`}">
    <span class="avatar" style="width:38px;height:38px;font-size:14px">${esc(initiales(d.clientSnapshot?.name || '?'))}</span>
    <span class="grandit"><span class="titre">${esc(d.clientSnapshot?.name || 'Sans client')}</span>
      <span class="detail">${esc(d.number || KIND_LABEL[d.kind] + ' en brouillon')}${d.kind === 'deposit' ? ' · acompte' : d.kind === 'balance' ? ' · solde' : ''} · ${esc(dateFR(d.issueDate))}</span></span>
    <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="montant gras" style="font-size:15px">${d.kind === 'credit' ? '− ' : ''}${euros(amount)}</span>${pill(st)}</span></a>`;
}

// ===========================================================================
// Création de brouillons
// ===========================================================================
function blankDoc(kind, clientId = '') {
  const s = store.settings;
  const today = todayISO();
  const client = clientId ? store.get('clients', clientId) : null;
  return {
    id: uid(), kind, number: '', status: 'draft', clientId: client ? client.id : '',
    clientSnapshot: clientSnapshot(client), issueDate: today,
    dueDate: isInvoiceKind(kind) ? defaultDueDate(today) : '',
    servicePeriod: isInvoiceKind(kind) ? moisAnnee(today) : '',
    validityDays: kind === 'quote' ? s.quoteValidityDays || 30 : undefined,
    depositPct: kind === 'quote' ? s.depositPct ?? 50 : undefined,
    startDate: '', paymentTerms: s.paymentTerms || 'Virement bancaire', message: '', lines: [], deductions: [],
  };
}

async function createFromQuote(quote, kind) {
  const d = blankDoc(kind, quote.clientId);
  d.quoteId = quote.id; d.quoteNumber = quote.number; d.clientSnapshot = quote.clientSnapshot;
  if (kind === 'deposit') {
    const amount = docTotals(quote).deposit;
    d.lines = [{ label: `Acompte de ${quote.depositPct} % sur le devis ${quote.number}`, description: quote.templateName || '', qty: 1, unit: 'forfait', priceCents: amount }];
    d.servicePeriod = 'Acompte à la commande';
    d.dueDate = addDays(d.issueDate, 7);
  } else {
    d.lines = deepClone(quote.lines);
    const deposits = store.all('documents').filter((x) => x.kind === 'deposit' && x.quoteId === quote.id && x.number);
    d.deductions = deposits.map((x) => ({ documentId: x.id, number: x.number, date: x.issueDate, amountCents: docTotals(x).due }));
    if (kind === 'balance' && !deposits.length) d.kind = 'invoice';
  }
  await store.put('documents', d);
  navigate(`#/edition/${d.id}?etape=${kind === 'deposit' ? 3 : 1}`);
}

async function createCredit(inv) {
  const st = invoiceStatus(inv);
  const d = blankDoc('credit', inv.clientId);
  Object.assign(d, {
    clientSnapshot: inv.clientSnapshot, invoiceId: inv.id, invoiceNumber: inv.number, invoiceDate: inv.issueDate,
    reason: '', servicePeriod: inv.servicePeriod, dueDate: '',
    lines: [{ label: `Annulation de la facture ${inv.number}`, description: '', qty: 1, unit: 'forfait', priceCents: Math.max(0, docTotals(inv).due - st.credited) }],
  });
  await store.put('documents', d);
  navigate(`#/edition/${d.id}?etape=1`);
}

async function duplicate(doc) {
  const kind = doc.kind === 'quote' ? 'quote' : 'invoice';
  const d = blankDoc(kind, doc.clientId);
  d.lines = deepClone(doc.lines).filter((l) => !/^Acompte de/.test(l.label));
  d.message = doc.message || '';
  await store.put('documents', d);
  toast('Copie créée en brouillon.');
  navigate(`#/edition/${d.id}?etape=2`);
}

// ===========================================================================
// Éditeur (3 étapes)
// ===========================================================================
let current = null; // document en cours de modification

export function renderEditor(el, [id], query = {}) {
  if (id === 'nouveau') {
    const kind = ['quote', 'invoice'].includes(query.type) ? query.type : 'invoice';
    current = blankDoc(kind, query.client || '');
    current._new = true;
  } else if (!current || current.id !== id) {
    const found = store.get('documents', id);
    if (!found) { el.innerHTML = '<div class="vide">Document introuvable.</div>'; return; }
    if (found.number) { navigate(`#/document/${id}`); return; }
    current = deepClone(found);
  }
  const etape = Number(query.etape) || (current._new ? (current.clientId ? 2 : 1) : 1);
  drawEditor(el, etape);
}

async function persist() {
  if (!current.clientId && !(current.kind === 'credit')) return false;
  const { _new, ...doc } = current;
  doc.clientSnapshot = clientSnapshot(store.get('clients', doc.clientId)) || doc.clientSnapshot;
  await store.put('documents', doc);
  if (_new) { delete current._new; history.replaceState(null, '', `#/edition/${current.id}?etape=2`); }
  const flag = document.querySelector('[data-saved]');
  if (flag) flag.hidden = false;
  return true;
}

let saveTimer = null;
function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 600); }

function drawEditor(el, etape) {
  const d = current;
  const label = KIND_LABEL[d.kind];
  const back = d._new ? (d.kind === 'quote' ? '#/devis' : '#/factures') : (d.kind === 'quote' ? '#/devis?f=brouillon' : d.kind === 'credit' ? '#/avoirs' : '#/factures?f=brouillon');
  const steps = ['Client', 'Prestations', 'Aperçu'];

  el.innerHTML = `<div class="pile">
    <div class="entre">
      <a class="icone-btn" href="${back}" aria-label="Fermer">${icon('close', 18)}</a>
      <h1 style="font-size:22px">${d._new ? (d.kind === 'quote' ? 'Nouveau devis' : 'Nouvelle facture') : esc(label)}</h1>
      <span class="ligne tres-petit" style="gap:4px;color:var(--vert)" data-saved ${d._new ? 'hidden' : ''}>${icon('check', 14)}Enregistré</span>
    </div>
    <ol class="etapes" aria-label="Étapes">${steps.map((s, i) => `<li class="${i + 1 < etape ? 'fait' : i + 1 === etape ? 'actif' : ''}" ${i + 1 === etape ? 'aria-current="step"' : ''}>${i + 1} · ${s}</li>`).join('')}</ol>
    <div id="etape"></div>
  </div>`;
  const box = el.querySelector('#etape');
  if (etape === 1) step1(el, box);
  else if (etape === 2) step2(el, box);
  else step3(el, box);
}

function go(el, etape) {
  history.replaceState(null, '', `#/edition/${current.id}?etape=${etape}`);
  drawEditor(el, etape);
  window.scrollTo(0, 0);
}

// ---------- Étape 1 : client et informations ----------
function step1(el, box) {
  const d = current;
  const clients = store.all('clients').filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const selected = d.clientId ? store.get('clients', d.clientId) : null;
  const pct = d.depositPct ?? 0;

  box.innerHTML = `<form class="pile" novalidate>
    ${d.kind === 'credit' ? `<div class="carte-voile petit">Avoir sur la facture <strong>${esc(d.invoiceNumber)}</strong> du ${esc(dateFR(d.invoiceDate))}, client ${esc(d.clientSnapshot?.name || '')}.</div>
      ${zoneTexte({ label: 'Motif de l’avoir *', name: 'reason', value: d.reason, placeholder: 'Ex. : erreur sur le nombre de publications' })}`
    : `<span class="etiquette">Client</span>
      ${selected ? `<div class="element"><span class="avatar">${esc(initiales(selected.name))}</span><span class="grandit"><span class="titre">${esc(selected.name)}</span>
          <span class="detail">${isPro(selected) ? 'Entreprise · mentions pro ajoutées' : 'Particulier'}</span></span><button type="button" class="lien-btn" data-change>Changer</button></div>` : ''}
      <div data-picker ${selected ? 'hidden' : ''} class="pile">
        <label class="champ recherche">${icon('search', 20)}<input type="search" data-q placeholder="Rechercher un client" aria-label="Rechercher un client"></label>
        <div class="liste" style="max-height:320px;overflow:auto">${clients.map((c) => `<button type="button" class="element" data-pick="${c.id}" data-nom="${esc(norm(c.name))}"><span class="avatar">${esc(initiales(c.name))}</span><span class="titre grandit">${esc(c.name)}</span></button>`).join('')}</div>
        <a class="btn petit discret" href="#/client-edition/nouveau">${icon('plus', 18)} Nouveau client</a>
      </div>`}
    <span class="etiquette">Informations</span>
    <div class="grille-2">
      ${champ({ label: d.kind === 'quote' ? 'Date du devis' : 'Date d’émission', name: 'issueDate', type: 'date', value: d.issueDate })}
      ${isInvoiceKind(d.kind) ? champ({ label: 'Échéance', name: 'dueDate', type: 'date', value: d.dueDate }) : ''}
      ${d.kind === 'quote' ? champ({ label: 'Validité (jours)', name: 'validityDays', type: 'number', value: d.validityDays, attrs: 'inputmode="numeric" min="1"' }) : ''}
    </div>
    ${isInvoiceKind(d.kind) ? champ({ label: 'Prestation réalisée (date ou période) *', name: 'servicePeriod', value: d.servicePeriod, placeholder: 'Ex. : octobre 2026', aide: 'Mention obligatoire sur la facture.' }) : ''}
    ${d.kind === 'quote' ? `${champ({ label: 'Début de la prestation (facultatif)', name: 'startDate', type: 'date', value: d.startDate })}
      <div class="entre"><span class="gras" style="font-size:16px">Acompte à la signature</span>
        <div class="seg" role="group" aria-label="Pourcentage d'acompte" data-pct>${[0, 30, 50].map((p) => `<button type="button" data-p="${p}" class="${pct === p ? 'actif' : ''}">${p} %</button>`).join('')}</div></div>` : ''}
    ${d.kind !== 'credit' ? choix({ label: 'Moyen de paiement', name: 'paymentTerms', value: d.paymentTerms, options: ['Virement bancaire', 'Virement bancaire ou chèque', 'Virement bancaire ou carte bancaire'] }) : ''}
    ${d.kind !== 'credit' ? zoneTexte({ label: 'Message (facultatif)', name: 'message', value: d.message, placeholder: 'Ex. : Merci pour votre confiance.' }) : ''}
    <p class="erreur-form liste-erreurs" hidden></p>
    <button type="submit" class="btn plein">Suivant : prestations</button>
  </form>`;

  const form = box.querySelector('form');
  form.querySelector('[data-change]')?.addEventListener('click', () => { form.querySelector('[data-picker]').hidden = false; form.querySelector('[data-q]').focus(); });
  form.querySelector('[data-q]')?.addEventListener('input', (e) => {
    const v = norm(e.target.value);
    form.querySelectorAll('[data-pick]').forEach((b) => { b.hidden = v && !b.dataset.nom.includes(v); });
  });
  form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    readStep1(form);
    current.clientId = b.dataset.pick;
    current.clientSnapshot = clientSnapshot(store.get('clients', b.dataset.pick));
    if (!current._new) autosave();
    step1(el, box);
  }));
  form.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    current.depositPct = Number(b.dataset.p);
    form.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('actif', x === b));
  }));
  form.addEventListener('input', () => { readStep1(form); if (!current._new) autosave(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    readStep1(form);
    const p = form.querySelector('.erreur-form');
    if (current.kind !== 'credit' && !current.clientId) { p.hidden = false; p.textContent = 'Choisissez un client.'; return; }
    await persist();
    go(el, 2);
  });
}

function readStep1(form) {
  const f = formData(form);
  for (const k of ['issueDate', 'dueDate', 'servicePeriod', 'startDate', 'paymentTerms', 'message', 'reason']) if (k in f) current[k] = f[k];
  if ('validityDays' in f) current.validityDays = Number(f.validityDays) || 30;
}

// ---------- Étape 2 : prestations ----------
function lineEditor(l, i) {
  return `<div class="ligne-doc" data-i="${i}">
    <div class="ligne" style="align-items:flex-start">
      <input class="libelle grandit" data-k="label" value="${esc(l.label)}" aria-label="Désignation" placeholder="Désignation" style="border:1px solid var(--bord-champ);border-radius:12px;padding:10px 12px;min-height:46px;font-size:16px;background:var(--blanc)">
      <button type="button" class="icone-btn" data-rm aria-label="Retirer la ligne">${icon('trash', 18)}</button>
    </div>
    <textarea data-k="description" rows="1" aria-label="Description" placeholder="Description (facultatif)" spellcheck="true" style="border:1px solid var(--bord-champ);border-radius:12px;padding:8px 12px;font-size:15px;background:var(--blanc);resize:vertical;min-height:40px">${esc(l.description || '')}</textarea>
    <div class="ligne" style="flex-wrap:wrap;gap:8px">
      <span class="pas"><button type="button" data-moins aria-label="Moins">−</button><input data-k="qty" inputmode="decimal" value="${esc(qtyToText(Number(l.qty) || 0))}" aria-label="Quantité"><button type="button" data-plus aria-label="Plus">+</button></span>
      <select data-k="unit" aria-label="Unité" style="border:1px solid var(--bord-champ);border-radius:999px;padding:8px 10px;background:var(--blanc);font-size:15px">${[...new Set([...UNITS, l.unit].filter(Boolean))].map((u) => `<option ${u === l.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>
      <span class="ligne" style="gap:4px">× <input data-k="price" inputmode="decimal" value="${centsToInput(l.priceCents)}" aria-label="Prix unitaire en euros" style="width:92px;border:1px solid var(--bord-champ);border-radius:999px;padding:8px 10px;text-align:right;background:var(--blanc);font-size:15px"> €</span>
      <span class="grandit montant gras" data-lt style="text-align:right">${euros(lineTotal(l))}</span>
    </div></div>`;
}

function step2(el, box) {
  const d = current;
  const t = docTotals(d);
  const templates = store.all('templates');

  box.innerHTML = `<div class="pile" style="padding-bottom:170px">
    ${d.kind === 'quote' || d.kind === 'invoice' ? `<label class="champ" style="flex-direction:row;align-items:center;justify-content:space-between;gap:10px;background:var(--voile);border-radius:14px;padding:8px 12px">Modèle
      <select data-tpl style="max-width:240px;min-height:42px"><option value="">Choisir…</option>${templates.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    <div class="carte" style="padding:2px 14px" data-lines>${d.lines.map(lineEditor).join('') || '<div class="vide">Ajoutez une prestation.</div>'}</div>
    ${(d.deductions || []).length ? `<div class="carte-voile pile" style="gap:4px"><span class="etiquette">Acomptes déjà facturés</span>${d.deductions.map((x) => `<div class="entre petit"><span>${esc(x.number)} du ${esc(dateFR(x.date))}</span><span class="montant">− ${euros(x.amountCents)}</span></div>`).join('')}</div>` : ''}
    <div class="grille-2">
      <button type="button" class="btn secondaire" data-add-svc>${icon('plus', 18)} Prestation</button>
      <button type="button" class="btn discret" data-add-free>${icon('plus', 18)} Ligne libre</button>
    </div>
    ${d.kind !== 'credit' ? `<button type="button" class="btn petit discret" data-add-disc>${icon('tag', 18)} Ajouter une remise</button>` : ''}
  </div>
  <div class="total-bas"><div class="contenu">
    <div class="entre"><span style="font-weight:400">${d.kind === 'credit' ? 'Montant de l’avoir' : d.kind === 'quote' ? 'Total' : 'Total à régler'}</span><span class="grand-montant montant" data-total>${euros(t.due)}</span></div>
    ${d.kind === 'quote' ? `<div class="entre petit doux" data-dep-row ${t.deposit ? '' : 'hidden'}><span>Acompte ${d.depositPct} % à la signature</span><span class="montant" data-deposit style="color:var(--encre)">${euros(t.deposit)}</span></div>` : ''}
    <span class="tres-petit doux">TVA non applicable, art. 293 B du CGI</span>
    <div class="grille-2"><button type="button" class="btn discret" data-prev>Retour</button><button type="button" class="btn" data-next>Voir l'aperçu</button></div>
  </div></div>`;

  const refreshTotals = () => {
    const tt = docTotals(current);
    box.querySelector('[data-total]').textContent = euros(tt.due);
    const dep = box.querySelector('[data-deposit]');
    if (dep) { dep.textContent = euros(tt.deposit); box.querySelector('[data-dep-row]').hidden = !tt.deposit; }
    box.querySelectorAll('[data-i]').forEach((row) => { row.querySelector('[data-lt]').textContent = euros(lineTotal(current.lines[Number(row.dataset.i)])); });
  };

  const linesBox = box.querySelector('[data-lines]');
  linesBox.addEventListener('input', (e) => {
    const row = e.target.closest('[data-i]'); if (!row) return;
    const l = current.lines[Number(row.dataset.i)];
    const k = e.target.dataset.k;
    if (k === 'qty') l.qty = parseQty(e.target.value);
    else if (k === 'price') { const v = parseEuros(e.target.value); if (v !== null) l.priceCents = v; }
    else if (k) l[k] = e.target.value;
    refreshTotals(); autosave();
  });
  linesBox.addEventListener('change', (e) => { if (e.target.dataset.k === 'unit') { current.lines[Number(e.target.closest('[data-i]').dataset.i)].unit = e.target.value; autosave(); } });
  linesBox.addEventListener('click', (e) => {
    const row = e.target.closest('[data-i]'); if (!row) return;
    const i = Number(row.dataset.i); const l = current.lines[i];
    if (e.target.closest('[data-rm]')) {
      const removed = current.lines.splice(i, 1)[0];
      autosave(); step2(el, box);
      toast('Ligne retirée.', { undo: () => { current.lines.splice(i, 0, removed); autosave(); step2(el, box); } });
    } else if (e.target.closest('[data-plus]') || e.target.closest('[data-moins]')) {
      const step = e.target.closest('[data-plus]') ? 1 : -1;
      l.qty = Math.max(0, Math.round(((Number(l.qty) || 0) + step) * 100) / 100);
      row.querySelector('[data-k=qty]').value = qtyToText(l.qty);
      refreshTotals(); autosave();
    }
  });

  box.querySelector('[data-tpl]')?.addEventListener('change', async (e) => {
    const tpl = store.get('templates', e.target.value); if (!tpl) return;
    if (current.lines.length && !(await confirmer({ title: 'Remplacer les lignes ?', text: `Le modèle « ${esc(tpl.name)} » remplacera les prestations déjà saisies.`, ok: 'Remplacer' }))) { e.target.value = ''; return; }
    current.lines = templateToLines(tpl); current.templateName = tpl.name;
    autosave(); step2(el, box);
  });
  box.querySelector('[data-add-svc]').addEventListener('click', async () => {
    const svc = await pickService(); if (!svc) return;
    current.lines.push({ label: svc.name, description: svc.description || '', qty: 1, unit: svc.unit, priceCents: svc.priceCents });
    autosave(); step2(el, box);
  });
  box.querySelector('[data-add-free]').addEventListener('click', () => {
    current.lines.push({ label: '', description: '', qty: 1, unit: 'forfait', priceCents: 0 });
    step2(el, box);
    const rows = box.querySelectorAll('[data-i]'); rows[rows.length - 1]?.querySelector('[data-k=label]').focus();
  });
  box.querySelector('[data-add-disc]')?.addEventListener('click', async () => {
    const res = await sheet({
      title: 'Ajouter une remise',
      html: `<form class="pile">${champ({ label: 'Remise en %', name: 'pct', attrs: 'inputmode="decimal"', placeholder: 'Ex. : 10' })}
        <p class="tres-petit doux" style="margin:0">ou</p>${champ({ label: 'Remise en €', name: 'eur', attrs: 'inputmode="decimal"', placeholder: 'Ex. : 50' })}
        ${champ({ label: 'Libellé', name: 'label', value: 'Remise' })}<button class="btn plein" type="submit">Ajouter</button></form>`,
      bind: (root, close) => root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); close(formData(root)); }),
    });
    if (!res) return;
    const base = current.lines.filter((l) => l.priceCents > 0).reduce((s, l) => s + lineTotal(l), 0);
    const amount = res.pct ? percentOf(base, parseQty(res.pct)) : parseEuros(res.eur) || 0;
    if (!amount) return;
    current.lines.push({ label: res.label || 'Remise', description: res.pct ? `${res.pct} %` : '', qty: 1, unit: 'forfait', priceCents: -Math.abs(amount) });
    autosave(); step2(el, box);
  });
  box.querySelector('[data-prev]').addEventListener('click', async () => { await persist(); go(el, 1); });
  box.querySelector('[data-next]').addEventListener('click', async () => { await persist(); go(el, 3); });
}

function pickService() {
  const services = store.all('services').filter((s) => !s.archived);
  const cats = [...new Set(services.map((s) => s.category))];
  return sheet({
    title: 'Choisir une prestation',
    html: `<div class="pile">${cats.map((c) => `<span class="etiquette">${esc(c)}</span><div class="liste">${services.filter((s) => s.category === c).map((s) => `
      <button type="button" class="element" data-s="${s.id}" style="background:var(--blanc)"><span class="titre grandit">${esc(s.name)}</span><span class="montant petit">${euros(s.priceCents)} / ${esc(s.unit)}</span></button>`).join('')}</div>`).join('')}</div>`,
    bind: (root, close) => root.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => close(store.get('services', b.dataset.s)))),
  });
}

// ---------- Étape 3 : aperçu et finalisation ----------
function step3(el, box) {
  const d = current;
  const client = d.kind === 'credit' ? d.clientSnapshot : store.get('clients', d.clientId);
  const missing = missingMentions(d, store.settings, client);
  const verbe = d.kind === 'quote' ? 'Finaliser le devis' : d.kind === 'credit' ? 'Émettre l’avoir' : 'Finaliser la facture';

  box.innerHTML = `<div class="pile">
    ${missing.length ? `<div class="carte-alerte pile" style="gap:6px"><strong>Avant de finaliser, il manque :</strong>
      <ul class="liste-erreurs">${missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <div class="ligne" style="flex-wrap:wrap"><button type="button" class="btn petit secondaire" data-step1>Compléter le document</button><a class="btn petit secondaire" href="#/reglages">Réglages</a>${d.clientId ? `<a class="btn petit secondaire" href="#/client-edition/${d.clientId}">Fiche client</a>` : ''}</div></div>`
    : `<div class="carte-voile ligne petit" style="color:var(--vert)">${icon('check', 18)} Toutes les mentions obligatoires sont présentes.</div>`}
    <div>${docHTML(d)}</div>
    <button type="button" class="btn plein" data-final ${missing.length ? 'disabled' : ''}>${icon('lock', 20)} ${verbe}</button>
    <div class="grille-2"><button type="button" class="btn discret" data-prev>Modifier</button><button type="button" class="btn discret" data-later>Plus tard</button></div>
    <button type="button" class="lien-btn" data-del style="color:var(--rouge)">Supprimer ce brouillon</button>
  </div>`;

  fitDocs(box);
  box.querySelector('[data-step1]')?.addEventListener('click', () => go(el, 1));
  box.querySelector('[data-prev]').addEventListener('click', () => go(el, 2));
  box.querySelector('[data-later]').addEventListener('click', async () => { await persist(); toast('Brouillon enregistré.'); navigate(d.kind === 'quote' ? '#/devis' : d.kind === 'credit' ? '#/avoirs' : '#/factures'); });
  box.querySelector('[data-del]').addEventListener('click', async () => {
    if (!(await confirmer({ title: 'Supprimer ce brouillon ?', text: 'Il n’a pas encore de numéro : il peut être supprimé.', ok: 'Supprimer', danger: true }))) return;
    if (!d._new) await store.remove('documents', d.id);
    current = null; toast('Brouillon supprimé.');
    navigate(d.kind === 'quote' ? '#/devis' : '#/factures');
  });
  box.querySelector('[data-final]').addEventListener('click', async () => {
    const text = d.kind === 'quote'
      ? 'Le devis reçoit son numéro définitif. Vous pourrez ensuite l’envoyer au client.'
      : 'Le numéro définitif est attribué et le document ne pourra plus être modifié. En cas d’erreur, il faudra faire un avoir.';
    if (!(await confirmer({ title: `${verbe} ?`, text, ok: verbe }))) return;
    await finalize();
    toast(`${KIND_LABEL[d.kind]} ${current.number} finalisé${d.kind === 'quote' || d.kind === 'credit' ? '' : 'e'}.`);
    const id = current.id; current = null;
    navigate(`#/document/${id}`);
  });
}

async function finalize() {
  const d = current;
  const year = (d.issueDate || todayISO()).slice(0, 4);
  const series = d.kind === 'quote' ? 'quote' : d.kind === 'credit' ? 'credit' : 'invoice';
  d.number = await store.nextNumber(series, year);
  d.finalizedAt = new Date().toISOString();
  d.sellerSnapshot = sellerSnapshot(store.settings);
  if (d.kind !== 'credit') d.clientSnapshot = clientSnapshot(store.get('clients', d.clientId));
  if (d.kind === 'quote') d.status = 'sent';
  delete d._new;
  await store.put('documents', d);
}

// ===========================================================================
// Fiche d'un document finalisé
// ===========================================================================
export function renderDetail(el, [id]) {
  const d = store.get('documents', id);
  if (!d) { el.innerHTML = '<div class="vide">Document introuvable. <a href="#/factures">Retour</a></div>'; return; }
  if (!d.number) { navigate(`#/edition/${id}`); return; }
  const st = docStatus(d);
  const t = docTotals(d);
  const back = d.kind === 'quote' ? '#/devis' : d.kind === 'credit' ? '#/avoirs' : '#/factures';
  const pays = paymentsFor(id).sort((a, b) => b.date.localeCompare(a.date));
  const credits = creditsFor(id);
  const linked = store.all('documents').filter((x) => x.quoteId === id);

  const actions = [];
  actions.push(['pdf', 'Télécharger le PDF', 'print', '']);
  actions.push(['mail', 'Envoyer par e-mail', 'mail', 'secondaire']);
  if (d.kind === 'quote') {
    if (st.code === 'envoye') { actions.push(['accept', 'Le client a accepté', 'check', 'secondaire']); actions.push(['refuse', 'Le client a refusé', 'close', 'discret']); }
    if (st.code === 'accepte') {
      const hasDeposit = linked.some((x) => x.kind === 'deposit');
      const hasFinal = linked.some((x) => x.kind === 'balance' || x.kind === 'invoice');
      if (d.depositPct && !hasDeposit) actions.unshift(['deposit', `Créer la facture d'acompte (${euros(t.deposit)})`, 'file', '']);
      if (!hasFinal) actions.push(['balance', d.depositPct ? 'Créer la facture de solde' : 'Créer la facture', 'file', 'secondaire']);
    }
  }
  if (isInvoiceKind(d.kind) && !['payee', 'annulee'].includes(st.code)) {
    actions.unshift(['pay', 'Enregistrer un paiement', 'euro', '']);
    actions.push(['remind', 'Relancer le client', 'bell', 'secondaire']);
  }
  if (isInvoiceKind(d.kind) && st.code !== 'annulee') actions.push(['credit', 'Créer un avoir (en cas d’erreur)', 'undo', 'discret']);
  if (d.kind !== 'credit') actions.push(['dup', 'Dupliquer', 'copy', 'discret']);

  el.innerHTML = `<div class="pile">
    <a class="retour" href="${back}">${icon('back', 20)}${d.kind === 'quote' ? 'Devis' : d.kind === 'credit' ? 'Avoirs' : 'Factures'}</a>
    <div class="entre" style="align-items:flex-start">
      <div><div class="sous-titre">${esc(KIND_LABEL[d.kind])}</div><h1 style="font-size:24px">${esc(d.number)}</h1>
        <a class="petit" href="#/client/${d.clientId}">${esc(d.clientSnapshot?.name || '')}</a></div>
      ${pill(st)}
    </div>
    <div class="carte pile" style="gap:6px">
      <div class="entre"><span class="doux">${d.kind === 'credit' ? 'Montant de l’avoir' : 'Montant'}</span><span class="grand-montant montant">${d.kind === 'credit' ? '− ' : ''}${euros(t.due)}</span></div>
      ${isInvoiceKind(d.kind) ? `<div class="entre petit"><span class="doux">Échéance</span><span>${esc(dateFR(d.dueDate))}</span></div>
        ${st.paid ? `<div class="entre petit"><span class="doux">Déjà payé</span><span class="montant">${euros(st.paid)}</span></div>` : ''}
        ${st.credited ? `<div class="entre petit"><span class="doux">Avoirs</span><span class="montant">− ${euros(st.credited)}</span></div>` : ''}
        ${st.remaining && st.code !== 'annulee' ? `<div class="entre"><span class="gras">Reste à régler</span><span class="montant gras">${euros(st.remaining)}</span></div>` : ''}` : ''}
      ${d.kind === 'quote' && t.deposit ? `<div class="entre petit"><span class="doux">Acompte ${d.depositPct} %</span><span class="montant">${euros(t.deposit)}</span></div>` : ''}
      ${d.kind === 'credit' ? `<div class="petit doux">Sur la facture <a href="#/document/${d.invoiceId}">${esc(d.invoiceNumber)}</a> · ${esc(d.reason)}</div>` : ''}
      ${d.quoteNumber ? `<div class="petit doux">Devis d'origine : <a href="#/document/${d.quoteId}">${esc(d.quoteNumber)}</a></div>` : ''}
    </div>
    <div class="pile" style="gap:10px">${actions.map(([k, l, ic, cls]) => `<button type="button" class="btn plein ${cls}" data-a="${k}">${icon(ic, 20)} ${esc(l)}</button>`).join('')}</div>
    ${linked.length ? `<span class="etiquette">Factures liées</span><div class="liste">${linked.map(docRow).join('')}</div>` : ''}
    ${pays.length ? `<span class="etiquette">Paiements</span><div class="liste">${pays.map((p) => `<div class="element"><span class="grandit"><span class="titre montant">${euros(p.amountCents)}</span><span class="detail">${esc(dateFR(p.date))} · ${esc(p.method)}</span></span><button type="button" class="lien-btn" data-delpay="${p.id}" style="color:var(--rouge)">Retirer</button></div>`).join('')}</div>` : ''}
    ${credits.length ? `<span class="etiquette">Avoirs</span><div class="liste">${credits.map(docRow).join('')}</div>` : ''}
    <details><summary class="petit" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Voir le document</summary><div style="margin-top:8px">${docHTML(d)}</div></details>
    <p class="tres-petit doux">Document finalisé le ${esc(dateFR(d.finalizedAt))} : il ne peut plus être modifié${d.kind !== 'quote' ? ' (conservation légale 10 ans)' : ''}.</p>
  </div>`;

  el.querySelector('details')?.addEventListener('toggle', () => fitDocs(el));
  const refresh = () => renderDetail(el, [id]);
  el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
    const a = b.dataset.a;
    if (a === 'pdf') { printDoc(d); toast('Sur iPhone : touchez « Partager » puis « Enregistrer dans Fichiers ».', { duration: 7000 }); }
    if (a === 'mail') sendMail(d);
    if (a === 'accept') { await store.put('documents', { ...d, status: 'accepted', acceptedAt: todayISO() }); toast('Devis accepté. Bravo !'); refresh(); }
    if (a === 'refuse') { if (await confirmer({ title: 'Devis refusé ?', text: 'Le devis sera classé comme refusé.', ok: 'Oui, refusé' })) { await store.put('documents', { ...d, status: 'refused' }); refresh(); } }
    if (a === 'deposit') await createFromQuote(d, 'deposit');
    if (a === 'balance') await createFromQuote(d, 'balance');
    if (a === 'pay') { await recordPayment(d); refresh(); }
    if (a === 'remind') remind(d);
    if (a === 'credit') { if (await confirmer({ title: 'Créer un avoir ?', text: `Un avoir annule tout ou partie de la facture ${esc(d.number)}. Vous pourrez ajuster le montant à l’étape suivante.`, ok: 'Créer l’avoir' })) await createCredit(d); }
    if (a === 'dup') await duplicate(d);
  }));
  el.querySelectorAll('[data-delpay]').forEach((b) => b.addEventListener('click', async () => {
    const p = store.get('payments', b.dataset.delpay);
    if (await confirmer({ title: 'Retirer ce paiement ?', text: `${euros(p.amountCents)} du ${dateFR(p.date)}`, ok: 'Retirer', danger: true })) {
      await store.remove('payments', p.id);
      toast('Paiement retiré.', { undo: async () => { await store.put('payments', p); refresh(); } });
      refresh();
    }
  }));
}

async function recordPayment(d) {
  const st = invoiceStatus(d);
  const res = await sheet({
    title: 'Enregistrer un paiement',
    html: `<form class="pile" novalidate>
      ${champ({ label: 'Montant reçu (€)', name: 'amount', value: centsToInput(st.remaining), attrs: 'inputmode="decimal"' })}
      <div class="grille-2">${champ({ label: 'Date', name: 'date', type: 'date', value: todayISO() })}${choix({ label: 'Moyen', name: 'method', value: 'Virement', options: PAYMENT_METHODS })}</div>
      <p class="erreur-form liste-erreurs" hidden></p>
      <button type="submit" class="btn plein">Enregistrer</button></form>`,
    bind: (root, close) => root.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = formData(root);
      const amount = parseEuros(f.amount);
      if (!amount || amount <= 0) { const p = root.querySelector('.erreur-form'); p.hidden = false; p.textContent = 'Indiquez un montant valide.'; return; }
      close({ ...f, amountCents: amount });
    }),
  });
  if (!res) return;
  await store.put('payments', { documentId: d.id, date: res.date, amountCents: res.amountCents, method: res.method });
  const after = invoiceStatus(d);
  toast(after.code === 'payee' ? 'Paiement enregistré : facture payée.' : `Paiement enregistré. Reste ${euros(after.remaining)}.`);
}

function mailBody(d) {
  const s = store.settings;
  const t = docTotals(d);
  const hello = d.clientSnapshot?.contact ? `Bonjour ${d.clientSnapshot.contact},` : 'Bonjour,';
  const sign = `\n\nBelle journée,\n${s.firstName && !s.firstName.startsWith('[') ? s.firstName : ''}\n${s.tradeName}\nLa petite main des grandes entreprises`;
  if (d.kind === 'quote') return `${hello}\n\nVeuillez trouver ci-joint le devis ${d.number} d'un montant de ${euros(t.due)}.${t.deposit ? ` Un acompte de ${d.depositPct} % (${euros(t.deposit)}) est demandé à la signature.` : ''}\n\nPour l'accepter, il vous suffit de me le renvoyer signé avec la mention « Bon pour accord ».\nJe reste disponible pour toute question.${sign}`;
  if (d.kind === 'credit') return `${hello}\n\nVeuillez trouver ci-joint l'avoir ${d.number} d'un montant de ${euros(t.due)}, relatif à la facture ${d.invoiceNumber}.${sign}`;
  return `${hello}\n\nVeuillez trouver ci-joint la facture ${d.number} d'un montant de ${euros(t.due)}, à régler avant le ${dateFR(d.dueDate)} par virement.\n\nIBAN : ${s.iban}\nBIC : ${s.bic}\n\nMerci beaucoup.${sign}`;
}

function sendMail(d) {
  const subject = `${KIND_LABEL[d.kind]} ${d.number} · ${store.settings.tradeName}`;
  const body = mailBody(d);
  const email = store.get('clients', d.clientId)?.email || d.clientSnapshot?.email || '';
  sheet({
    title: 'Envoyer par e-mail',
    html: `<div class="pile">
      <ol class="petit" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
        <li>Téléchargez d'abord le PDF et enregistrez-le dans Fichiers.</li>
        <li>Ouvrez l'e-mail préparé, puis ajoutez le PDF en pièce jointe.</li></ol>
      <button type="button" class="btn plein secondaire" data-pdf>${icon('print', 20)} Télécharger le PDF</button>
      <a class="btn plein" href="mailto:${esc(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">${icon('mail', 20)} Ouvrir l'e-mail préparé</a>
      <button type="button" class="btn plein discret" data-copy>${icon('copy', 20)} Copier le texte</button></div>`,
    bind: (root) => {
      root.querySelector('[data-pdf]').addEventListener('click', () => printDoc(d));
      root.querySelector('[data-copy]').addEventListener('click', () => partagerTexte(subject, body));
    },
  });
}

function remind(d) {
  const st = invoiceStatus(d);
  const s = store.settings;
  const hello = d.clientSnapshot?.contact ? `Bonjour ${d.clientSnapshot.contact},` : 'Bonjour,';
  const sign = `\n\nBien cordialement,\n${s.tradeName}`;
  const base = `la facture ${d.number} du ${dateFR(d.issueDate)}, d'un montant restant de ${euros(st.remaining)}, arrivée à échéance le ${dateFR(d.dueDate)}`;
  const modeles = [
    ['Courtois', `${hello}\n\nSauf erreur de ma part, ${base} n'a pas encore été réglée. Il s'agit peut-être d'un simple oubli.\n\nVous trouverez l'IBAN sur la facture. N'hésitez pas à revenir vers moi si besoin.${sign}`],
    ['Ferme', `${hello}\n\nJe reviens vers vous concernant ${base}, toujours en attente de règlement malgré mon précédent message.\n\nMerci de procéder au paiement dans les meilleurs délais. Je vous rappelle que des pénalités de retard et une indemnité forfaitaire de 40 € sont prévues par mes conditions de vente.${sign}`],
    ['Dernier rappel', `${hello}\n\nMalgré mes relances, ${base} reste impayée.\n\nSans règlement sous 8 jours, je serai contrainte d'engager une procédure de recouvrement (mise en demeure), avec application des pénalités de retard et de l'indemnité forfaitaire de 40 €.${sign}`],
  ];
  const email = store.get('clients', d.clientId)?.email || '';
  sheet({
    title: 'Relancer le client',
    html: `<div class="pile">${modeles.map(([nom, txt], i) => `<div class="carte pile" style="gap:8px">
      <div class="entre"><strong>${i + 1}. ${esc(nom)}</strong></div>
      <p class="petit doux" style="margin:0;white-space:pre-line;max-height:120px;overflow:auto">${esc(txt)}</p>
      <div class="grille-2"><a class="btn petit" href="mailto:${esc(email)}?subject=${encodeURIComponent(`Relance : facture ${d.number}`)}&body=${encodeURIComponent(txt)}">E-mail</a>
      <button type="button" class="btn petit discret" data-copy="${i}">Copier</button></div></div>`).join('')}</div>`,
    bind: (root) => root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => partagerTexte(`Relance ${d.number}`, modeles[Number(b.dataset.copy)][1]))),
  });
}

// ===========================================================================
// Aperçu plein écran (impression)
// ===========================================================================
export function renderPreview(el, [id]) {
  const d = store.get('documents', id);
  if (!d) { el.innerHTML = '<div class="vide">Document introuvable.</div>'; return; }
  el.innerHTML = `<div class="pile">${entete('Aperçu', { retour: { href: `#/document/${id}`, label: 'Retour' } })}
    <div>${docHTML(d, { withCgv: d.kind === 'quote' })}</div>
    <button type="button" class="btn plein" data-print>${icon('print', 20)} Télécharger le PDF</button></div>`;
  fitDocs(el);
  el.querySelector('[data-print]').addEventListener('click', () => printDoc(d));
}
