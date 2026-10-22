// Règles métier et mentions légales : totaux, statuts, contrôle avant finalisation.
// Micro-entreprise non assujettie à la TVA : tous les montants sont nets.

import { store } from './store.js';
import { lineTotal, todayISO, addDays, digits } from './util.js';

export const KIND_LABEL = {
  quote: 'Devis',
  invoice: 'Facture',
  deposit: 'Facture d’acompte',
  balance: 'Facture de solde',
  credit: 'Avoir',
};

export const UNITS = ['forfait', 'heure', 'mois', 'unité', 'lot', 'séance', 'jour'];
export const PAYMENT_METHODS = ['Virement', 'Carte bancaire', 'Chèque', 'Espèces', 'PayPal', 'Autre'];

export function isInvoiceKind(kind) {
  return kind === 'invoice' || kind === 'deposit' || kind === 'balance';
}

export function isPro(clientOrSnapshot) {
  return clientOrSnapshot && clientOrSnapshot.type !== 'part';
}

/** Somme des lignes (centimes). */
export function linesTotal(lines) {
  return (lines || []).reduce((s, l) => s + lineTotal(l), 0);
}

/** Totaux d'un document : brut, déductions d'acomptes, montant à régler. */
export function docTotals(doc) {
  const gross = linesTotal(doc.lines);
  const deductions = (doc.deductions || []).reduce((s, d) => s + (Number(d.amountCents) || 0), 0);
  const due = Math.max(0, gross - deductions);
  const deposit = doc.kind === 'quote' && doc.depositPct ? Math.round(gross * doc.depositPct / 100) : 0;
  return { gross, deductions, due, deposit };
}

/** Paiements enregistrés pour une facture. */
export function paymentsFor(docId) {
  return store.all('payments').filter((p) => p.documentId === docId);
}

/** Avoirs finalisés liés à une facture. */
export function creditsFor(docId) {
  return store.all('documents').filter((d) => d.kind === 'credit' && d.invoiceId === docId && d.number);
}

/**
 * Situation de paiement d'une facture finalisée.
 * Renvoie { code, label, cls, paid, credited, remaining }.
 */
export function invoiceStatus(doc) {
  if (!doc.number) return { code: 'brouillon', label: 'Brouillon', cls: 'p-orange', paid: 0, credited: 0, remaining: docTotals(doc).due };
  const due = docTotals(doc).due;
  const paid = paymentsFor(doc.id).reduce((s, p) => s + (Number(p.amountCents) || 0), 0);
  const credited = creditsFor(doc.id).reduce((s, c) => s + docTotals(c).due, 0);
  const remaining = Math.max(0, due - paid - credited);
  if (credited >= due && due > 0) return { code: 'annulee', label: 'Annulée par avoir', cls: 'p-gris', paid, credited, remaining: 0 };
  if (remaining === 0) return { code: 'payee', label: 'Payée', cls: 'p-vert', paid, credited, remaining };
  const late = doc.dueDate && doc.dueDate < todayISO();
  if (paid > 0) return { code: late ? 'en_retard' : 'partiel', label: late ? 'Partielle, en retard' : 'Partiellement payée', cls: late ? 'p-rouge' : 'p-orange', paid, credited, remaining };
  if (late) return { code: 'en_retard', label: 'En retard', cls: 'p-rouge', paid, credited, remaining };
  return { code: 'a_payer', label: 'À payer', cls: 'p-orange', paid, credited, remaining };
}

export function quoteValidUntil(doc) {
  return addDays(doc.issueDate || todayISO(), doc.validityDays || 30);
}

export function quoteStatus(doc) {
  if (!doc.number) return { code: 'brouillon', label: 'Brouillon', cls: 'p-orange' };
  if (doc.status === 'accepted') return { code: 'accepte', label: 'Accepté', cls: 'p-vert' };
  if (doc.status === 'refused') return { code: 'refuse', label: 'Refusé', cls: 'p-gris' };
  if (quoteValidUntil(doc) < todayISO()) return { code: 'expire', label: 'Expiré', cls: 'p-gris' };
  return { code: 'envoye', label: 'Envoyé', cls: 'p-rose' };
}

export function creditStatus(doc) {
  return doc.number ? { code: 'emis', label: 'Émis', cls: 'p-gris' } : { code: 'brouillon', label: 'Brouillon', cls: 'p-orange' };
}

export function docStatus(doc) {
  if (doc.kind === 'quote') return quoteStatus(doc);
  if (doc.kind === 'credit') return creditStatus(doc);
  return invoiceStatus(doc);
}

/** Copie figée des informations de la vendeuse au moment de la finalisation. */
export function sellerSnapshot(s) {
  return {
    name: `${s.firstName} ${s.lastName}`.trim(), tradeName: s.tradeName,
    address: s.address, postcode: s.postcode, city: s.city,
    siret: s.siret, ape: s.ape, email: s.email, phone: s.phone,
    iban: s.iban, bic: s.bic, vatMention: s.vatMention,
    latePenalty: s.latePenalty, rcPro: s.rcPro, mediator: s.mediator,
  };
}

export function clientSnapshot(c) {
  if (!c) return null;
  return {
    id: c.id, type: c.type, name: c.name, legalForm: c.legalForm, contact: c.contact,
    address: c.address, postcode: c.postcode, city: c.city,
    siren: c.siren || (c.siret ? digits(c.siret).slice(0, 9) : ''), siret: c.siret, vat: c.vat, email: c.email,
  };
}

/**
 * Liste des mentions manquantes avant de finaliser un document.
 * Un document incomplet ne peut pas être finalisé.
 */
export function missingMentions(doc, settings, client) {
  const m = [];
  const s = settings;
  if (!s.firstName || !s.lastName) m.push('Votre prénom et votre nom (Réglages)');
  if (!s.address || !s.postcode || !s.city) m.push('Votre adresse complète (Réglages)');
  if (digits(s.siret).length !== 14) m.push('Votre SIRET à 14 chiffres (Réglages)');
  if (!client) m.push('Le client');
  else {
    if (!client.name) m.push('Le nom du client');
    if (!client.address || !client.postcode || !client.city) m.push('L’adresse de facturation du client');
    if (isPro(client) && digits(client.siren || client.siret).length < 9) m.push('Le SIREN du client (entreprise)');
    if (!isPro(client) && doc.kind !== 'credit' && !s.mediator) m.push('Votre médiateur de la consommation (Réglages) : obligatoire pour un client particulier');
  }
  if (!doc.lines || !doc.lines.length) m.push('Au moins une prestation');
  if ((doc.lines || []).some((l) => !String(l.label || '').trim())) m.push('Une désignation pour chaque ligne');
  if (docTotals(doc).gross < 0) m.push('Un total positif ou nul (vérifiez les remises)');
  if (doc.kind === 'credit' && docTotals(doc).gross <= 0) m.push('Un montant d’avoir supérieur à 0 €');
  if (isInvoiceKind(doc.kind)) {
    if (!doc.servicePeriod) m.push('La date ou la période de la prestation');
    if (!doc.dueDate) m.push('La date d’échéance');
    if (!s.iban) m.push('Votre IBAN (Réglages)');
  }
  if (doc.kind === 'credit' && !doc.reason) m.push('Le motif de l’avoir');
  return m;
}

/** Échéance par défaut. */
export function defaultDueDate(issueDate) {
  return addDays(issueDate || todayISO(), store.settings.paymentDays || 30);
}
