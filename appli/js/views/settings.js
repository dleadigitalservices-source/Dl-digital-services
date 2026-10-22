// Réglages : identité, banque, mentions légales, CGV, préférences d'affichage, données.

import { store, DEFAULT_SETTINGS } from '../store.js';
import { esc, digits, todayISO } from '../util.js';
import { icon, toast, entete, champ, zoneTexte, choix, formData, confirmer, telecharger } from '../ui.js';
import { catalogueDepart, demoData } from '../demo.js';
import { navigate } from '../app.js';

export function render(el) {
  const s = store.settings;
  const demo = store.isDemo;
  const real = store.hasRealFinalized();
  const secure = store.mode === 'supabase';
  const placeholder = (v) => (String(v || '').startsWith('[') ? '' : v);

  el.innerHTML = `<form class="pile-l" novalidate>
    ${entete('Réglages', { retour: { href: '#/plus', label: 'Plus' } })}

    ${demo ? `<div class="carte-voile pile" style="gap:8px">
      <strong>Mode démonstration</strong>
      <span class="petit">Les clients, factures et rendez-vous sont fictifs. Quand vous êtes prête, effacez-les : votre catalogue de prestations et vos modèles sont conservés.</span>
      <button type="button" class="btn petit" data-cleardemo>Effacer les données de démonstration</button></div>` : ''}

    <div class="carte pile" style="gap:6px">
      <div class="ligne">${icon('lock', 20)}<strong>${secure ? 'Données protégées (base sécurisée en Europe)' : 'Données enregistrées sur cet appareil uniquement'}</strong></div>
      <span class="petit doux">${secure ? 'Connexion par mot de passe, déconnexion automatique après 15 minutes.' : 'Pour protéger vos vraies données par un mot de passe et les retrouver sur tous vos appareils, il faut relier la base sécurisée Supabase (voir le guide).'}</span>
      ${secure ? '<button type="button" class="btn petit discret" data-logout>Se déconnecter</button>' : ''}
    </div>

    <section class="pile"><h2>Mon entreprise</h2>
      <div class="grille-2">${champ({ label: 'Prénom', name: 'firstName', value: placeholder(s.firstName), attrs: 'autocapitalize="words"' })}${champ({ label: 'Nom', name: 'lastName', value: placeholder(s.lastName), attrs: 'autocapitalize="words"' })}</div>
      <p class="tres-petit doux" style="margin:-4px 0 0">Affichés seulement sur les documents légaux (devis, factures), suivis de « EI ».</p>
      ${champ({ label: 'Nom commercial', name: 'tradeName', value: s.tradeName })}
      ${champ({ label: 'Adresse', name: 'address', value: placeholder(s.address) })}
      <div class="grille-2">${champ({ label: 'Code postal', name: 'postcode', value: s.postcode, attrs: 'inputmode="numeric"' })}${champ({ label: 'Ville', name: 'city', value: s.city })}</div>
      <div class="grille-2">${champ({ label: 'SIRET (14 chiffres)', name: 'siret', value: digits(s.siret) === '00000000000000' ? '' : s.siret, attrs: 'inputmode="numeric"' })}${champ({ label: 'Code APE (facultatif)', name: 'ape', value: s.ape })}</div>
      <div class="grille-2">${champ({ label: 'E-mail pro', name: 'email', type: 'email', value: s.email, attrs: 'autocapitalize="off"' })}${champ({ label: 'Téléphone pro', name: 'phone', type: 'tel', value: s.phone })}</div>
    </section>

    <section class="pile"><h2>Banque</h2>
      ${champ({ label: 'IBAN', name: 'iban', value: s.iban.includes('0000 0000') ? '' : s.iban, attrs: 'autocapitalize="characters" autocomplete="off"', aide: 'Affiché sur vos factures pour le virement.' })}
      ${champ({ label: 'BIC', name: 'bic', value: s.bic === 'XXXXFRPP' ? '' : s.bic, attrs: 'autocapitalize="characters"' })}
    </section>

    <section class="pile"><h2>Devis et factures</h2>
      <div class="grille-2">${champ({ label: 'Délai de paiement (jours)', name: 'paymentDays', type: 'number', value: s.paymentDays, attrs: 'inputmode="numeric" min="0"' })}${champ({ label: 'Acompte par défaut (%)', name: 'depositPct', type: 'number', value: s.depositPct, attrs: 'inputmode="numeric" min="0" max="100"' })}</div>
      ${champ({ label: 'Validité des devis (jours)', name: 'quoteValidityDays', type: 'number', value: s.quoteValidityDays, attrs: 'inputmode="numeric" min="1"' })}
      <div class="grille-2">${champ({ label: 'Préfixe factures', name: 'invoicePrefix', value: s.invoicePrefix, attrs: real ? 'readonly' : '' })}${champ({ label: 'Préfixe avoirs', name: 'creditPrefix', value: s.creditPrefix, attrs: real ? 'readonly' : '' })}</div>
      ${champ({ label: 'Préfixe devis', name: 'quotePrefix', value: s.quotePrefix, attrs: real ? 'readonly' : '' })}
      ${real ? '<p class="tres-petit doux" style="margin:-4px 0 0">Les préfixes sont verrouillés : la numérotation doit rester continue.</p>' : ''}
      ${champ({ label: 'Mention TVA', name: 'vatMention', value: s.vatMention })}
      ${zoneTexte({ label: 'Mentions de retard (clients professionnels)', name: 'latePenalty', value: s.latePenalty })}
      ${champ({ label: 'Assurance RC Pro (facultatif)', name: 'rcPro', value: s.rcPro, placeholder: 'Assureur, zone couverte' })}
      ${champ({ label: 'Médiateur de la consommation', name: 'mediator', value: s.mediator, placeholder: 'Nom, adresse, site internet', aide: 'Obligatoire avant votre premier client particulier. Inutile pour les professionnels et associations.' })}
      ${zoneTexte({ label: 'Conditions générales de vente (CGV)', name: 'cgv', value: s.cgv, placeholder: 'Collez ici le texte de vos CGV : il sera joint à chaque devis.', aide: 'Copiez le texte depuis votre document CGV, sans la partie « À compléter ».' })}
    </section>

    <section class="pile"><h2>URSSAF</h2>
      ${choix({ label: 'Rythme de déclaration', name: 'urssafRhythm', value: s.urssafRhythm, options: [['mensuel', 'Mensuel'], ['trimestriel', 'Trimestriel']] })}
    </section>

    <section class="pile"><h2>Confort de lecture</h2>
      <label class="case"><input type="checkbox" name="bigText" ${s.bigText ? 'checked' : ''}>Texte plus grand</label>
      <label class="case"><input type="checkbox" name="dysFont" ${s.dysFont ? 'checked' : ''}>Police plus lisible (dyslexie)</label>
    </section>

    <p class="erreur-form liste-erreurs" hidden></p>
    <button type="submit" class="btn plein">Enregistrer les réglages</button>

    <section class="pile"><h2>Mes données</h2>
      <button type="button" class="btn plein secondaire" data-export>${icon('download', 20)} Exporter toutes mes données</button>
      <p class="tres-petit doux" style="margin:-4px 0 0">Gardez une copie de sauvegarde chaque mois (fichier à ranger dans Fichiers ou iCloud).</p>
      <label class="btn plein discret" style="cursor:pointer">${icon('undo', 20)} Restaurer une sauvegarde<input type="file" accept="application/json,.json" data-import hidden></label>
      ${!demo && !real ? '<button type="button" class="btn plein discret" data-loaddemo>Recharger la démonstration</button>' : ''}
    </section>
  </form>`;

  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formData(form);
    const errors = [];
    if (f.siret && digits(f.siret).length !== 14) errors.push('Le SIRET doit contenir 14 chiffres.');
    const iban = f.iban.replace(/\s/g, '').toUpperCase();
    if (iban && !/^FR\d{2}[0-9A-Z]{23}$/.test(iban)) errors.push('L’IBAN français commence par FR et contient 27 caractères.');
    const p = form.querySelector('.erreur-form');
    if (errors.length) { p.hidden = false; p.innerHTML = errors.map(esc).join('<br>'); p.scrollIntoView({ block: 'center' }); return; }
    p.hidden = true;
    await store.saveSettings({
      ...f, siret: digits(f.siret), iban: iban.replace(/(.{4})/g, '$1 ').trim(), bic: f.bic.toUpperCase(),
      paymentDays: Number(f.paymentDays) || 30, depositPct: Math.min(100, Math.max(0, Number(f.depositPct) || 0)),
      quoteValidityDays: Number(f.quoteValidityDays) || 30,
    });
    toast('Réglages enregistrés.');
  });

  form.querySelector('[data-export]').addEventListener('click', () => {
    telecharger(`sauvegarde-dl-digital-services-${todayISO()}.json`, store.exportJSON(), 'application/json');
    const t = store.all('tasks').find((x) => x.id === `export-${todayISO().slice(0, 7)}`);
    if (t && !t.done) store.put('tasks', { ...t, done: true, doneAt: new Date().toISOString().slice(0, 16) });
    toast('Sauvegarde téléchargée.');
  });

  form.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast('Ce fichier n’est pas une sauvegarde valide.'); return; }
    if (!data || !Array.isArray(data.documents) || !Array.isArray(data.clients)) { toast('Ce fichier n’est pas une sauvegarde de l’application.'); return; }
    if (!(await confirmer({ title: 'Restaurer cette sauvegarde ?', text: `Les données actuelles seront remplacées par celles du ${esc(String(data.exportedAt || '').slice(0, 10).split('-').reverse().join('/'))}.`, ok: 'Restaurer', danger: true }))) return;
    await store.replaceAll({ ...data, meta: { ...(data.meta || {}), seeded: true } });
    toast('Sauvegarde restaurée.');
    navigate('#/accueil');
  });

  form.querySelector('[data-cleardemo]')?.addEventListener('click', async () => {
    if (!(await confirmer({ title: 'Effacer la démonstration ?', text: 'Les clients, devis, factures, paiements, rendez-vous et tâches fictifs seront supprimés. Votre catalogue et vos modèles sont conservés. La numérotation repart de 1.', ok: 'Effacer la démo', danger: true }))) return;
    const { services, templates } = catalogueDepart();
    const keep = { ...store.settings };
    for (const k of ['firstName', 'lastName', 'address']) if (String(keep[k]).startsWith('[')) keep[k] = '';
    if (keep.postcode === '44000' && keep.city === 'Nantes' && !keep.address) { keep.postcode = ''; keep.city = ''; }
    if (digits(keep.siret) === '00000000000000') keep.siret = DEFAULT_SETTINGS.siret;
    if (keep.iban.includes('0000 0000')) keep.iban = '';
    if (keep.bic === 'XXXXFRPP') keep.bic = '';
    await store.replaceAll({ services, templates, settings: keep, counters: {}, meta: { demo: false, seeded: true } });
    toast('Démonstration effacée. Complétez vos réglages pour vos vraies factures.');
    navigate('#/reglages');
  });

  form.querySelector('[data-loaddemo]')?.addEventListener('click', async () => {
    if (!(await confirmer({ title: 'Recharger la démonstration ?', text: 'Les données actuelles seront remplacées par des exemples.', ok: 'Recharger' }))) return;
    await store.replaceAll(demoData());
    navigate('#/accueil');
  });

  form.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await store.signOut();
    location.reload();
  });
}
