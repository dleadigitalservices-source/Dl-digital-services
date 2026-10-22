// Clients : liste avec recherche, fiche avec historique, formulaire avec import par SIRET.

import { store } from '../store.js';
import { esc, euros, norm, initiales, digits, formatSiret, todayISO, dateFR } from '../util.js';
import { icon, toast, entete, champ, zoneTexte, choix, formData, confirmer, pill } from '../ui.js';
import { docStatus, docTotals, KIND_LABEL } from '../legal.js';
import { navigate } from '../app.js';

export function renderList(el, params, query = {}) {
  const filtre = query.f || 'tous';
  const q = query.q || '';
  let list = store.all('clients').filter((c) => (filtre === 'archives' ? c.archived : !c.archived));
  if (filtre === 'pro') list = list.filter((c) => c.type !== 'part');
  if (filtre === 'part') list = list.filter((c) => c.type === 'part');
  const nq = norm(q);
  if (nq) list = list.filter((c) => norm(`${c.name} ${c.contact} ${c.email} ${c.city}`).includes(nq));
  list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  el.innerHTML = `<div class="pile">
    <div class="entete"><div><h1>Clients</h1><div class="sous-titre">${store.all('clients').filter((c) => !c.archived).length} clients actifs</div></div></div>
    <label class="champ recherche"><span class="sr" style="position:absolute;left:-9999px">Rechercher un client</span>${icon('search', 20)}
      <input type="search" id="rech" value="${esc(q)}" placeholder="Rechercher un client" autocomplete="off"></label>
    <div class="seg">
      ${[['tous', 'Tous'], ['pro', 'Entreprises'], ['part', 'Particuliers'], ['archives', 'Archivés']].map(([k, l]) => `<a href="#/clients?f=${k}" class="${filtre === k ? 'actif' : ''}">${l}</a>`).join('')}
    </div>
    <div class="liste" id="liste">${list.map(row).join('') || `<div class="vide">${q ? 'Aucun client trouvé.' : 'Aucun client pour l’instant.'}</div>`}</div>
    <a class="btn plein secondaire" href="#/client-edition/nouveau">${icon('plus', 20)} Ajouter un client</a>
  </div>`;

  const input = el.querySelector('#rech');
  input.addEventListener('input', () => {
    const v = norm(input.value);
    el.querySelectorAll('[data-nom]').forEach((a) => { a.hidden = v && !a.dataset.nom.includes(v); });
  });
  document.getElementById('fab').onclick = (e) => { e.preventDefault(); navigate('#/client-edition/nouveau'); };
}

function row(c) {
  return `<a class="element" href="#/client/${c.id}" data-nom="${esc(norm(`${c.name} ${c.contact} ${c.email} ${c.city}`))}">
    <span class="avatar">${esc(initiales(c.name))}</span>
    <span class="grandit"><span class="titre">${esc(c.name)}</span><span class="detail">${esc([c.type === 'part' ? 'Particulier' : (c.legalForm || 'Entreprise'), c.contact, c.city].filter(Boolean).join(' · '))}</span></span>
    ${icon('chevron', 18)}</a>`;
}

export function renderDetail(el, [id], query = {}) {
  const c = store.get('clients', id);
  if (!c) { el.innerHTML = '<div class="vide">Client introuvable. <a href="#/clients">Retour</a></div>'; return; }
  const onglet = query.o || 'docs';
  const docs = store.all('documents').filter((d) => d.clientId === id).sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)));
  const events = store.all('events').filter((e) => e.clientId === id).sort((a, b) => b.start.localeCompare(a.start));
  const tasks = store.all('tasks').filter((t) => t.clientId === id && !t.done);
  const month = todayISO().slice(0, 7);
  const pubsMonth = store.all('events').filter((e) => e.clientId === id && e.type === 'publication' && e.start.startsWith(month)).length;

  let contenu = '';
  if (onglet === 'docs') {
    contenu = docs.map((d) => {
      const st = docStatus(d);
      return `<a class="element" href="#/document/${d.id}"><span class="grandit">
        <span class="titre">${esc(KIND_LABEL[d.kind])} ${esc(d.number || '')}</span>
        <span class="detail">${esc(dateFR(d.issueDate))} · <span class="montant">${euros(docTotals(d).due)}</span></span></span>${pill(st)}</a>`;
    }).join('') || '<div class="vide">Aucun document pour ce client.</div>';
  } else if (onglet === 'rdv') {
    contenu = events.map((e) => `<div class="element"><span class="grandit"><span class="titre">${esc(e.title)}</span><span class="detail">${esc(dateFR(e.start))} à ${e.start.slice(11, 16)}</span></span></div>`).join('') || '<div class="vide">Aucun rendez-vous.</div>';
  } else {
    contenu = `<div class="carte" style="white-space:pre-line">${c.notes ? esc(c.notes) : '<span class="doux">Aucune note. Ajoutez-en depuis « Modifier ».</span>'}</div>`;
  }

  el.innerHTML = `<div class="pile">
    <a class="retour" href="#/clients">${icon('back', 20)}Clients</a>
    <div class="ligne" style="gap:14px">
      <span class="avatar grand">${esc(initiales(c.name))}</span>
      <div class="grandit"><h1 style="font-size:25px">${esc(c.name)}</h1>
        <div class="sous-titre">${esc([c.type === 'part' ? 'Particulier' : (c.legalForm || 'Entreprise'), c.city].filter(Boolean).join(' · '))}</div></div>
    </div>
    ${c.archived ? '<div class="carte-voile petit">Client archivé.</div>' : ''}
    ${c.importedAt ? `<span class="pastille p-vert" style="align-self:flex-start">${icon('check', 14)} Infos importées depuis l'annuaire des entreprises</span>` : ''}
    <div class="actions-rondes">
      <a class="action-ronde" href="${c.phone ? `tel:${esc(digits(c.phone))}` : '#'}" ${c.phone ? '' : 'aria-disabled="true"'}><span class="rond">${icon('phone')}</span>Appeler</a>
      <a class="action-ronde" href="${c.email ? `mailto:${esc(c.email)}` : '#'}"><span class="rond">${icon('mail')}</span>E-mail</a>
      <a class="action-ronde" href="#/edition/nouveau?type=quote&client=${c.id}"><span class="rond">${icon('filePlus')}</span>Devis</a>
      <a class="action-ronde" href="#/edition/nouveau?type=invoice&client=${c.id}"><span class="rond">${icon('file')}</span>Facture</a>
    </div>
    <div class="carte pile" style="gap:6px;font-size:15px">
      ${c.contact ? `<div class="entre"><span class="doux">Contact</span><span>${esc(c.contact)}</span></div>` : ''}
      ${c.phone ? `<div class="entre"><span class="doux">Téléphone</span><span>${esc(c.phone)}</span></div>` : ''}
      ${c.email ? `<div class="entre"><span class="doux">E-mail</span><span style="overflow-wrap:anywhere;text-align:right">${esc(c.email)}</span></div>` : ''}
      <div class="entre"><span class="doux">Adresse</span><span style="text-align:right">${esc([c.address, `${c.postcode || ''} ${c.city || ''}`.trim()].filter(Boolean).join(', ')) || '<span class="doux">à compléter</span>'}</span></div>
      ${c.type !== 'part' ? `<div class="entre"><span class="doux">SIRET</span><span>${esc(formatSiret(c.siret || c.siren)) || '<span class="doux">à compléter</span>'}</span></div>` : ''}
    </div>
    ${pubsMonth || tasks.length ? `<div class="carte-voile petit">${pubsMonth ? `${pubsMonth} publication${pubsMonth > 1 ? 's' : ''} prévue${pubsMonth > 1 ? 's' : ''} ce mois-ci. ` : ''}${tasks.length ? `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} en cours.` : ''}</div>` : ''}
    <div class="seg" role="tablist">
      <a role="tab" href="#/client/${id}?o=docs" class="${onglet === 'docs' ? 'actif' : ''}">Documents</a>
      <a role="tab" href="#/client/${id}?o=rdv" class="${onglet === 'rdv' ? 'actif' : ''}">Rendez-vous</a>
      <a role="tab" href="#/client/${id}?o=notes" class="${onglet === 'notes' ? 'actif' : ''}">Notes</a>
    </div>
    <div class="liste">${contenu}</div>
    <a class="btn plein secondaire" href="#/client-edition/${id}">Modifier la fiche</a>
  </div>`;
}

// ---------- Import depuis l'annuaire officiel des entreprises (gratuit) ----------
const FORMES = { 1000: 'EI', 5499: 'SARL', 5498: 'EURL', 5710: 'SAS', 5720: 'SASU', 5599: 'SA', 9220: 'Association', 9210: 'Association', 6540: 'SCI', 5202: 'SNC' };

export function tvaFromSiren(siren) {
  const s = digits(siren);
  if (s.length !== 9) return '';
  const key = (12 + 3 * (Number(s) % 97)) % 97;
  return `FR${String(key).padStart(2, '0')}${s}`;
}

async function lookup(numero) {
  const q = digits(numero);
  if (q.length !== 9 && q.length !== 14) throw new Error('Saisissez un SIREN (9 chiffres) ou un SIRET (14 chiffres).');
  const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${q}&page=1&per_page=1`);
  if (!res.ok) throw new Error('Annuaire indisponible pour le moment. Réessayez plus tard.');
  const data = await res.json();
  const r = data.results && data.results[0];
  if (!r) throw new Error('Aucune entreprise trouvée avec ce numéro.');
  let etab = r.siege || {};
  if (q.length === 14 && Array.isArray(r.matching_etablissements)) etab = r.matching_etablissements.find((e) => e.siret === q) || etab;
  const voie = [etab.numero_voie, etab.indice_repetition, etab.type_voie, etab.libelle_voie].filter(Boolean).join(' ');
  return {
    name: r.nom_raison_sociale || r.nom_complet || '',
    legalForm: FORMES[Number(r.nature_juridique)] || '',
    siren: r.siren || q.slice(0, 9),
    siret: etab.siret || (q.length === 14 ? q : ''),
    address: voie || (etab.adresse || '').replace(/\s\d{5}\s.*$/, ''),
    postcode: etab.code_postal || '',
    city: etab.libelle_commune || '',
    vat: tvaFromSiren(r.siren || q.slice(0, 9)),
  };
}

export function renderEdit(el, [id]) {
  const isNew = id === 'nouveau';
  const c = isNew ? { type: 'pro', name: '', legalForm: '', contact: '', email: '', phone: '', address: '', postcode: '', city: '', siren: '', siret: '', vat: '', notes: '' } : store.get('clients', id);
  if (!c) { el.innerHTML = '<div class="vide">Client introuvable.</div>'; return; }

  el.innerHTML = `<form class="pile" novalidate>
    ${entete(isNew ? 'Nouveau client' : 'Modifier le client', { retour: { href: isNew ? '#/clients' : `#/client/${id}`, label: 'Annuler' } })}
    <div class="seg" role="radiogroup" aria-label="Type de client">
      <label style="flex:1"><input type="radio" name="type" value="pro" ${c.type !== 'part' ? 'checked' : ''} hidden><span class="seg-b">Entreprise ou association</span></label>
      <label style="flex:1"><input type="radio" name="type" value="part" ${c.type === 'part' ? 'checked' : ''} hidden><span class="seg-b">Particulier</span></label>
    </div>
    <div class="carte pile bloc-pro">
      <span class="etiquette">Remplissage automatique</span>
      <div class="ligne" style="align-items:flex-end">
        <div class="grandit">${champ({ label: 'SIREN ou SIRET', name: 'siretLookup', value: c.siret || c.siren, attrs: 'inputmode="numeric" autocomplete="off"' })}</div>
        <button type="button" class="btn petit" data-import style="margin-bottom:5px">Importer</button>
      </div>
      <p class="tres-petit doux" style="margin:0">Données issues de l'annuaire officiel des entreprises. Vérifiez-les avant d'enregistrer.</p>
      <p class="tres-petit" data-import-msg hidden></p>
    </div>
    ${champ({ label: 'Nom ou raison sociale *', name: 'name', value: c.name, attrs: 'required autocapitalize="words"' })}
    <div class="grille-2 bloc-pro">${champ({ label: 'Forme juridique', name: 'legalForm', value: c.legalForm, placeholder: 'SARL, SAS, Association…' })}${champ({ label: 'Nom du contact', name: 'contact', value: c.contact, attrs: 'autocapitalize="words"' })}</div>
    <div class="grille-2">${champ({ label: 'E-mail', name: 'email', type: 'email', value: c.email, attrs: 'autocapitalize="off" inputmode="email"' })}${champ({ label: 'Téléphone', name: 'phone', type: 'tel', value: c.phone, attrs: 'inputmode="tel"' })}</div>
    ${champ({ label: 'Adresse de facturation *', name: 'address', value: c.address })}
    <div class="grille-2">${champ({ label: 'Code postal *', name: 'postcode', value: c.postcode, attrs: 'inputmode="numeric"' })}${champ({ label: 'Ville *', name: 'city', value: c.city, attrs: 'autocapitalize="words"' })}</div>
    <div class="grille-2 bloc-pro">${champ({ label: 'SIREN *', name: 'siren', value: c.siren, attrs: 'inputmode="numeric"', aide: '9 chiffres, obligatoire sur les factures' })}${champ({ label: 'SIRET', name: 'siret', value: c.siret, attrs: 'inputmode="numeric"' })}</div>
    <div class="bloc-pro">${champ({ label: 'N° de TVA intracommunautaire', name: 'vat', value: c.vat, aide: 'Calculé à partir du SIREN : à vérifier' })}</div>
    ${zoneTexte({ label: 'Notes', name: 'notes', value: c.notes, placeholder: 'Préférences, horaires, informations utiles…' })}
    <p class="erreur-form liste-erreurs" hidden></p>
    <button type="submit" class="btn plein">${isNew ? 'Ajouter le client' : 'Enregistrer'}</button>
    ${isNew ? '' : `<button type="button" class="btn plein danger" data-suppr>${c.archived ? 'Désarchiver' : 'Supprimer ou archiver'}</button>`}
  </form>`;

  const form = el.querySelector('form');
  const styleSeg = () => {
    form.querySelectorAll('.seg label').forEach((l) => {
      const on = l.querySelector('input').checked;
      const s = l.querySelector('.seg-b');
      s.style.cssText = `display:block;text-align:center;border-radius:999px;padding:9px 6px;font-size:14px;cursor:pointer;${on ? 'background:var(--framboise);color:var(--ivoire);font-weight:500' : 'color:var(--encre-douce)'}`;
    });
    const pro = form.querySelector('[name=type]:checked').value !== 'part';
    form.querySelectorAll('.bloc-pro').forEach((b) => { b.hidden = !pro; });
  };
  form.querySelectorAll('[name=type]').forEach((r) => r.addEventListener('change', styleSeg));
  styleSeg();

  form.querySelector('[data-import]').addEventListener('click', async () => {
    const msg = form.querySelector('[data-import-msg]');
    msg.hidden = false; msg.style.color = 'var(--encre-douce)'; msg.textContent = 'Recherche en cours…';
    try {
      const info = await lookup(form.querySelector('[name=siretLookup]').value);
      for (const [k, v] of Object.entries(info)) { const f = form.querySelector(`[name=${k}]`); if (f && v) f.value = v; }
      form.dataset.imported = '1';
      msg.style.color = 'var(--vert)'; msg.textContent = `Trouvé : ${info.name}. Vérifiez puis enregistrez.`;
    } catch (err) {
      msg.style.color = 'var(--rouge)'; msg.textContent = err.message;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formData(form);
    delete f.siretLookup;
    f.siren = digits(f.siren); f.siret = digits(f.siret);
    if (!f.siren && f.siret.length === 14) f.siren = f.siret.slice(0, 9);
    const errors = [];
    if (!f.name) errors.push('Le nom ou la raison sociale');
    if (f.type !== 'part' && f.siren && f.siren.length !== 9) errors.push('Un SIREN à 9 chiffres');
    const p = form.querySelector('.erreur-form');
    if (errors.length) { p.hidden = false; p.innerHTML = `À compléter : ${errors.map(esc).join(', ')}`; return; }
    if (f.type === 'part') { f.siren = ''; f.siret = ''; f.vat = ''; f.legalForm = ''; }
    const saved = await store.put('clients', { ...c, ...f, importedAt: form.dataset.imported ? new Date().toISOString() : c.importedAt || null, archived: c.archived || false });
    toast(isNew ? 'Client ajouté.' : 'Fiche enregistrée.');
    navigate(`#/client/${saved.id}`);
  });

  form.querySelector('[data-suppr]')?.addEventListener('click', async () => {
    if (c.archived) { await store.put('clients', { ...c, archived: false }); toast('Client désarchivé.'); navigate(`#/client/${id}`); return; }
    const hasDocs = store.all('documents').some((d) => d.clientId === id && d.number);
    if (hasDocs) {
      if (await confirmer({ title: 'Archiver ce client ?', text: 'Ce client a des documents finalisés : la loi impose de les conserver. Il sera archivé (masqué), pas supprimé.', ok: 'Archiver' })) {
        await store.put('clients', { ...c, archived: true });
        toast('Client archivé.', { undo: async () => { await store.put('clients', { ...c, archived: false }); } });
        navigate('#/clients');
      }
      return;
    }
    if (await confirmer({ title: 'Supprimer ce client ?', text: `La fiche de ${esc(c.name)} sera supprimée.`, ok: 'Supprimer', danger: true })) {
      await store.remove('clients', id);
      toast('Client supprimé.', { undo: async () => { await store.put('clients', c); } });
      navigate('#/clients');
    }
  });
}
