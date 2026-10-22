// Catalogue de départ (vrais tarifs, à valider) et données de démonstration.
// Aucune donnée personnelle réelle ici : ce fichier est public.

import { uid, todayISO, addDays, nowLocalDT } from './util.js';
import { sellerSnapshot, clientSnapshot } from './legal.js';
import { DEFAULT_SETTINGS } from './store.js';

const S = (category, name, unit, euros, description = '') => ({
  id: uid(), category, name, unit, priceCents: Math.round(euros * 100), description, archived: false,
});

/** Catalogue de départ : conservé quand on efface la démo. */
export function catalogueDepart() {
  const services = [
    S('Community management', 'Forfait Présence', 'mois', 390, 'Engagement 3 mois'),
    S('Community management', 'Forfait Visibilité', 'mois', 590, 'Engagement 3 mois'),
    S('Community management', 'Forfait Signature', 'mois', 890, 'Engagement 3 mois'),
    S('Community management', 'Mise en place', 'forfait', 150),
    S('Assistance digitale', 'Assistance à l’heure', 'heure', 40),
    S('Assistance digitale', 'Pack 5 heures', 'forfait', 190),
    S('Assistance digitale', 'Pack 10 heures', 'forfait', 360),
    S('Assistance digitale', 'Pack 20 heures', 'forfait', 680),
    S('Visibilité', 'Diagnostic visibilité', 'forfait', 240, 'Déductible d’une commande'),
    S('Visibilité', 'Création de la fiche Google', 'forfait', 190),
    S('Visibilité', 'Gestion de la fiche Google', 'mois', 95),
    S('Outils digitaux', 'Page de liens', 'forfait', 150, 'Prix de départ'),
    S('Outils digitaux', 'Site vitrine', 'forfait', 590, 'Prix de départ'),
    S('Outils digitaux', 'Application de gestion sur mesure', 'forfait', 390, 'Prix de départ'),
    S('Création de contenus', 'Post', 'unité', 50),
    S('Création de contenus', 'Carrousel', 'unité', 90),
    S('Création de contenus', 'Reel', 'unité', 90),
    S('Création de contenus', '5 stories', 'lot', 45),
    S('Création de contenus', 'Légende seule', 'unité', 25),
    S('Création de contenus', 'Calendrier éditorial', 'forfait', 120),
    S('Conseil', 'Visio conseil', 'séance', 80),
  ];
  const by = (name) => services.find((s) => s.name === name).id;
  const T = (name, lines) => ({ id: uid(), name, lines });
  const templates = [
    T('Lancement Présence', [{ serviceId: by('Mise en place'), qty: 1 }, { serviceId: by('Forfait Présence'), qty: 3 }]),
    T('Lancement Visibilité', [{ serviceId: by('Mise en place'), qty: 1 }, { serviceId: by('Forfait Visibilité'), qty: 3 }]),
    T('Lancement Signature', [{ serviceId: by('Mise en place'), qty: 1 }, { serviceId: by('Forfait Signature'), qty: 3 }]),
    T('Fiche Google clé en main', [{ serviceId: by('Création de la fiche Google'), qty: 1 }, { serviceId: by('Gestion de la fiche Google'), qty: 3 }]),
    T('Présence en ligne', [{ serviceId: by('Site vitrine'), qty: 1 }, { serviceId: by('Page de liens'), qty: 1 }]),
    T('Pack assistance 10 h', [{ serviceId: by('Pack 10 heures'), qty: 1 }]),
    T('Offre privilège COULISSES', [{ serviceId: by('Diagnostic visibilité'), qty: 1, discountPct: 100 }]),
  ];
  return { services, templates };
}

function line(service, qty, extra = {}) {
  return { label: service.name, description: service.description || '', qty, unit: service.unit, priceCents: service.priceCents, ...extra };
}

/** Jeu complet de démonstration, daté par rapport à aujourd'hui. */
export function demoData() {
  const { services, templates } = catalogueDepart();
  const svc = (name) => services.find((s) => s.name === name);
  const today = todayISO();
  const year = today.slice(0, 4);
  const settings = { ...DEFAULT_SETTINGS, firstName: '[Prénom]', lastName: '[Nom]', address: '[Adresse]', postcode: '44000', city: 'Nantes', siret: '00000000000000', iban: 'FR76 0000 0000 0000 0000 0000 000', bic: 'XXXXFRPP' };
  const seller = sellerSnapshot(settings);

  const C = (type, name, extra) => ({ id: uid(), type, name, email: '', phone: '', address: '1 rue d’Exemple', postcode: '44000', city: 'Nantes', siren: type === 'pro' ? '000000000' : '', siret: '', vat: '', notes: '', archived: false, ...extra });
  const martin = C('pro', 'Boulangerie Martin', { legalForm: 'SARL', contact: 'Julie Martin', email: 'contact@exemple.fr', phone: '02 40 00 00 01', notes: 'Préfère être appelée le matin.' });
  const rose = C('pro', 'Atelier Rose', { legalForm: 'EI', contact: 'Camille', email: 'atelier@exemple.fr' });
  const batiment = C('pro', 'SARL Bâtiment Plus', { legalForm: 'SARL', contact: 'M. Leroy', email: 'compta@exemple.fr' });
  const asso = C('pro', 'Association Les Ateliers du Quai', { legalForm: 'Association', contact: 'Sophie, présidente' });
  const cafe = C('pro', 'Café des Halles', { legalForm: 'SAS', contact: 'Karim' });
  const clients = [martin, rose, batiment, asso, cafe];

  const D = (kind, client, fields) => ({
    id: uid(), kind, clientId: client.id, clientSnapshot: clientSnapshot(client), sellerSnapshot: seller,
    issueDate: today, lines: [], message: '', paymentTerms: settings.paymentTerms, ...fields,
  });

  const quote = D('quote', martin, {
    number: `DEV-${year}-0001`, status: 'accepted', issueDate: addDays(today, -20), validityDays: 30, depositPct: 50,
    lines: [line(svc('Mise en place'), 1), line(svc('Forfait Présence'), 3)], message: 'Merci pour votre confiance.', templateName: 'Lancement Présence',
  });
  const deposit = D('deposit', martin, {
    number: `FAC-${year}-0003`, quoteId: quote.id, quoteNumber: quote.number, issueDate: addDays(today, -18), dueDate: addDays(today, -11),
    servicePeriod: 'Acompte à la commande', finalizedAt: addDays(today, -18),
    lines: [{ label: `Acompte de 50 % sur le devis ${quote.number}`, description: 'Lancement Présence', qty: 1, unit: 'forfait', priceCents: 66000 }],
  });
  const balance = D('balance', martin, {
    number: '', quoteId: quote.id, quoteNumber: quote.number, issueDate: today, dueDate: addDays(today, 30), servicePeriod: '',
    lines: quote.lines.map((l) => ({ ...l })),
    deductions: [{ documentId: deposit.id, number: deposit.number, date: deposit.issueDate, amountCents: 66000 }],
  });
  const late = D('invoice', batiment, {
    number: `FAC-${year}-0001`, issueDate: addDays(today, -40), dueDate: addDays(today, -10), servicePeriod: 'Septembre',
    finalizedAt: addDays(today, -40), lines: [line(svc('Assistance à l’heure'), 8.75)],
  });
  const paid = D('invoice', rose, {
    number: `FAC-${year}-0002`, issueDate: addDays(today, -25), dueDate: addDays(today, 5), servicePeriod: 'Septembre',
    finalizedAt: addDays(today, -25), lines: [line(svc('Carrousel'), 4), line(svc('Reel'), 2), line(svc('Légende seule'), 4)],
  });
  const open = D('invoice', cafe, {
    number: `FAC-${year}-0004`, issueDate: addDays(today, -6), dueDate: addDays(today, 24), servicePeriod: 'Octobre',
    finalizedAt: addDays(today, -6), lines: [line(svc('Création de la fiche Google'), 1)],
  });
  const sent = D('quote', asso, {
    number: `DEV-${year}-0002`, status: 'sent', issueDate: addDays(today, -3), validityDays: 30, depositPct: 50,
    lines: [line(svc('Site vitrine'), 1), line(svc('Page de liens'), 1)], templateName: 'Présence en ligne',
  });
  const documents = [quote, deposit, balance, late, paid, open, sent];

  const payments = [
    { id: uid(), documentId: deposit.id, date: addDays(today, -15), amountCents: 66000, method: 'Virement' },
    { id: uid(), documentId: paid.id, date: addDays(today, -8), amountCents: 64000, method: 'Virement' },
    { id: uid(), documentId: open.id, date: addDays(today, -2), amountCents: 9500, method: 'Carte bancaire' },
  ];

  const at = (h, m) => `${today}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const tomorrow = addDays(today, 1);
  const events = [
    { id: uid(), title: 'Appel découverte', type: 'appel', clientId: martin.id, start: at(10, 30), durationMin: 30, place: 'Téléphone', notes: '', reminders: [60] },
    { id: uid(), title: 'Carrousel « Coulisses »', type: 'publication', clientId: '', start: at(14, 0), durationMin: 15, place: 'Instagram + Facebook', notes: '', reminders: [30] },
    { id: uid(), title: 'Tournage reel, mains et café', type: 'tournage', clientId: '', start: at(16, 30), durationMin: 60, place: 'Bureau', notes: '', reminders: [30] },
    { id: uid(), title: 'Rendez-vous Atelier Rose', type: 'rdv', clientId: rose.id, start: `${tomorrow}T11:00`, durationMin: 60, place: 'Nantes', notes: 'Apporter le calendrier éditorial.', reminders: [1080, 60] },
  ];

  const T = (title, fields) => ({ id: uid(), title, clientId: '', dueDate: today, dueTime: '', priority: 'normale', category: 'Administratif', estimateMin: 0, steps: [], recurrence: 'none', done: false, doneAt: null, auto: false, ...fields });
  const tasks = [
    T('Préparer les visuels Atelier Rose', { clientId: rose.id, priority: 'haute', category: 'Création', done: true, doneAt: nowLocalDT() }),
    T('Publier le carrousel « Coulisses »', { priority: 'haute', category: 'Publication', dueTime: '14:00', steps: [{ label: 'Relire la légende', done: true }, { label: 'Vérifier les visuels', done: true }, { label: 'Publier', done: false }] }),
    T('Préparer le devis Café des Halles', { clientId: cafe.id, priority: 'haute', dueTime: '15:00', estimateMin: 20 }),
    T('Publier le mardi sur Instagram', { category: 'Publication', recurrence: 'weekly', dueDate: addDays(today, 3), dueTime: '12:00' }),
    T(`Relancer la facture ${late.number}`, { clientId: batiment.id, priority: 'haute', dueTime: '16:00', auto: true, link: `#/document/${late.id}` }),
  ];

  return {
    settings, clients, services, templates, documents, payments, events, tasks,
    counters: { invoice: { [year]: 4 }, quote: { [year]: 2 }, credit: {} },
    meta: { demo: true, seeded: true },
  };
}
