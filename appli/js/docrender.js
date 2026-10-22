// Rendu d'un document (devis, facture, acompte, solde, avoir) au format A4,
// avec toutes les mentions obligatoires. Sert à l'aperçu et à l'impression PDF.

import { store } from './store.js';
import { esc, euros, dateFR, qtyToText, lineTotal, formatSiret } from './util.js';
import { KIND_LABEL, docTotals, isPro, isInvoiceKind, quoteValidUntil, sellerSnapshot, clientSnapshot } from './legal.js';

/** Informations à afficher : figées si le document est finalisé, sinon actuelles. */
function parties(doc) {
  const seller = doc.number && doc.sellerSnapshot ? doc.sellerSnapshot : sellerSnapshot(store.settings);
  const client = doc.number && doc.clientSnapshot ? doc.clientSnapshot : clientSnapshot(store.get('clients', doc.clientId)) || doc.clientSnapshot;
  return { seller, client };
}

export function docHTML(doc, { withCgv = false } = {}) {
  const { seller: s, client: c } = parties(doc);
  const t = docTotals(doc);
  const credit = doc.kind === 'credit';
  const sign = credit ? '− ' : '';
  const titre = KIND_LABEL[doc.kind].toUpperCase();
  const pro = isPro(c);

  const rows = (doc.lines || []).map((l) => `<tr>
      <td><strong style="font-weight:500">${esc(l.label)}</strong>${l.description ? `<span class="desc">${esc(l.description)}</span>` : ''}</td>
      <td class="c">${esc(qtyToText(Number(l.qty) || 0))}</td>
      <td class="c">${esc(l.unit || '')}</td>
      <td class="n montant">${euros(l.priceCents)}</td>
      <td class="n montant">${sign}${euros(lineTotal(l))}</td></tr>`).join('');

  const infos = [];
  if (isInvoiceKind(doc.kind) && doc.servicePeriod) infos.push(['Prestation réalisée', doc.servicePeriod]);
  infos.push(['Catégorie', 'prestation de services']);
  if (doc.quoteNumber) infos.push(['Réf. devis', doc.quoteNumber]);
  if (credit && doc.invoiceNumber) infos.push(['Facture d’origine', `${doc.invoiceNumber} du ${dateFR(doc.invoiceDate)}`]);
  if (doc.kind === 'quote') infos.push(['Valable jusqu’au', dateFR(quoteValidUntil(doc))]);
  if (doc.kind === 'quote' && doc.startDate) infos.push(['Début de la prestation', dateFR(doc.startDate)]);

  const deductions = (doc.deductions || []).map((d) => `<div class="entre"><span class="doux">Acompte ${esc(d.number)} du ${esc(dateFR(d.date))}</span><span class="montant">− ${euros(d.amountCents)}</span></div>`).join('');

  const totalLabel = credit ? 'Montant de l’avoir' : doc.kind === 'quote' ? 'Total' : 'Total à régler';

  return `<article class="doc" lang="fr">
    <div class="d-entete">
      <div class="d-vendeur">
        <img src="icons/logo.png" alt="DL Digital Services">
        <div>
          <div class="d-marque">${esc((s.tradeName || 'DL Digital Services').toUpperCase())}</div>
          <div style="font-weight:400">${esc(s.name || '[Prénom Nom]')} EI</div>
          <div>${esc(s.address || '[Adresse]')}, ${esc(s.postcode || '')} ${esc(s.city || '')}</div>
          <div>SIRET : ${esc(formatSiret(s.siret) || '[SIRET]')}${s.ape ? ` · APE ${esc(s.ape)}` : ''}</div>
          <div>${esc([s.email, s.phone].filter(Boolean).join(' · '))}</div>
        </div>
      </div>
      <div>
        <div class="d-titre">${esc(titre)}</div>
        <div class="d-num">${doc.number ? `N° ${esc(doc.number)}` : 'BROUILLON · non valable'}</div>
        <div style="text-align:right">${doc.kind === 'quote' ? 'Établi' : 'Émis'} le ${esc(dateFR(doc.issueDate))}</div>
        ${isInvoiceKind(doc.kind) && doc.dueDate ? `<div style="text-align:right">Échéance : ${esc(dateFR(doc.dueDate))}</div>` : ''}
      </div>
    </div>
    <div class="d-filet"></div>
    <div class="d-blocs">
      <div class="d-client">
        <div class="d-lib">${doc.kind === 'quote' ? 'Pour' : 'Facturé à'}</div>
        <div style="font-size:13.5px;font-weight:500">${esc(c?.name || '[Client]')}</div>
        ${c?.legalForm ? `<div>${esc(c.legalForm)}</div>` : ''}
        ${c?.contact ? `<div>À l’attention de ${esc(c.contact)}</div>` : ''}
        <div>${esc(c?.address || '')}${c?.postcode || c?.city ? `, ${esc(c?.postcode || '')} ${esc(c?.city || '')}` : ''}</div>
        ${pro && c?.siren ? `<div>SIREN : ${esc(formatSiret(c.siren))}</div>` : ''}
        ${pro && c?.vat ? `<div>N° TVA : ${esc(c.vat)}</div>` : ''}
      </div>
      <div style="padding:10px 0;display:flex;flex-direction:column;gap:3px">
        ${infos.map(([k, v]) => `<div><span class="doux">${esc(k)} :</span> ${esc(v)}</div>`).join('')}
      </div>
    </div>
    ${doc.message ? `<p style="margin:14px 0 0;white-space:pre-line">${esc(doc.message)}</p>` : ''}
    ${credit && doc.reason ? `<p style="margin:14px 0 0"><span class="doux">Motif :</span> ${esc(doc.reason)}</p>` : ''}
    <table>
      <thead><tr><th>Désignation</th><th class="c">Qté</th><th class="c">Unité</th><th class="n">Prix unitaire</th><th class="n">Montant</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="d-totaux">
      ${t.deductions ? `<div class="entre"><span class="doux">Total des prestations</span><span class="montant">${euros(t.gross)}</span></div>${deductions}` : ''}
      <div class="d-total-final"><span style="font-weight:500">${totalLabel}</span><strong class="montant">${sign}${euros(t.due)}</strong></div>
      <div style="text-align:right;font-size:10.5px">${esc(s.vatMention || 'TVA non applicable, art. 293 B du CGI')}</div>
      ${doc.kind === 'quote' && t.deposit ? `<div class="entre" style="margin-top:4px"><span>Acompte de ${doc.depositPct} % à la signature</span><span class="montant gras">${euros(t.deposit)}</span></div>` : ''}
    </div>

    ${isInvoiceKind(doc.kind) ? `<div class="d-mentions" style="font-size:11.5px;color:#3A0A14">
      <div class="d-lib">Conditions de paiement</div>
      <div>${esc(doc.paymentTerms || 'Virement bancaire')}, au plus tard le ${esc(dateFR(doc.dueDate))}.</div>
      <div>IBAN : ${esc(s.iban || '[IBAN]')} · BIC : ${esc(s.bic || '[BIC]')}</div></div>` : ''}
    ${doc.kind === 'quote' ? `<div class="d-mentions" style="font-size:11.5px;color:#3A0A14">
      <div class="d-lib">Conditions</div>
      <div>${t.deposit ? `Acompte de ${doc.depositPct} % (${euros(t.deposit)}) à la signature, solde à la livraison.` : 'Paiement à la livraison.'} Paiement par ${esc((doc.paymentTerms || 'virement bancaire').toLowerCase())}, à ${store.settings.paymentDays || 30} jours.</div>
      <div>Devis valable jusqu’au ${esc(dateFR(quoteValidUntil(doc)))}. La signature vaut acceptation des conditions générales de vente${store.settings.cgv ? ' jointes' : ''}.</div></div>
      <div class="d-accord"><div class="d-lib">Bon pour accord</div><div style="margin-top:6px">Date, nom et signature du client, précédés de la mention « Bon pour accord » :</div></div>` : ''}

    <div class="d-mentions">
      ${pro && doc.kind !== 'credit' ? `<div>${esc(s.latePenalty)}</div>` : ''}
      ${!pro && s.mediator ? `<div>En cas de litige, vous pouvez recourir gratuitement au médiateur de la consommation : ${esc(s.mediator)}.</div>` : ''}
      ${s.rcPro ? `<div>Assurance responsabilité civile professionnelle : ${esc(s.rcPro)}.</div>` : ''}
    </div>
    <div class="d-pied"><span class="d-slogan">La petite main des grandes entreprises</span><span>${esc(s.tradeName || 'DL Digital Services')} · ${esc(s.name || '')} EI</span></div>
    ${withCgv && store.settings.cgv ? `<section class="d-cgv"><h3>Conditions générales de vente</h3>${esc(store.settings.cgv)}</section>` : ''}
  </article>`;
}

/** Ouvre la fenêtre d'impression (sur iPhone : « Partager » puis « Enregistrer en PDF »). */
export function printDoc(doc) {
  const root = document.getElementById('print-root');
  root.innerHTML = docHTML(doc, { withCgv: doc.kind === 'quote' });
  const before = document.title;
  document.title = `${doc.number || 'Brouillon'} ${doc.clientSnapshot?.name || ''}`.trim();
  const img = root.querySelector('img');
  let done = false;
  const go = () => { if (done) return; done = true; window.print(); document.title = before; };
  if (img && !img.complete) { img.onload = go; img.onerror = go; } else go();
}

/** Réduit l'aperçu A4 pour qu'il tienne dans la largeur de l'écran. */
export function fitDocs(root = document) {
  root.querySelectorAll('#view .doc').forEach((d) => {
    const w = d.parentElement.clientWidth;
    d.style.zoom = String(Math.min(1, w / 794));
  });
}
window.addEventListener('resize', () => fitDocs());
