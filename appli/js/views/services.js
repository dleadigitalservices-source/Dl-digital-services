// Catalogue des prestations et modèles de devis.

import { store } from '../store.js';
import { esc, euros, parseEuros, centsToInput, parseQty, qtyToText, lineTotal } from '../util.js';
import { icon, toast, entete, sheet, champ, choix, zoneTexte, formData, confirmer } from '../ui.js';
import { UNITS } from '../legal.js';

const CATS = ['Community management', 'Assistance digitale', 'Visibilité', 'Outils digitaux', 'Création de contenus', 'Conseil', 'Autre'];

export function renderServices(el, params, query = {}) {
  const showArchived = query.a === '1';
  const list = store.all('services').filter((s) => Boolean(s.archived) === showArchived);
  const cats = [...new Set([...CATS, ...list.map((s) => s.category)])].filter((c) => list.some((s) => s.category === c));

  el.innerHTML = `<div class="pile">
    ${entete('Prestations', { retour: { href: '#/plus', label: 'Plus' }, sous: 'Votre catalogue : prix nets, TVA non applicable' })}
    <div class="seg"><a href="#/prestations" class="${showArchived ? '' : 'actif'}">Actives</a><a href="#/prestations?a=1" class="${showArchived ? 'actif' : ''}">Archivées</a></div>
    ${cats.map((cat) => `<span class="etiquette">${esc(cat)}</span><div class="liste">
      ${list.filter((s) => s.category === cat).sort((a, b) => a.priceCents - b.priceCents).map((s) => `
        <button type="button" class="element" data-id="${s.id}"><span class="grandit">
          <span class="titre">${esc(s.name)}</span>${s.description ? `<span class="detail">${esc(s.description)}</span>` : ''}</span>
          <span class="montant gras" style="font-size:15px;text-align:right">${euros(s.priceCents)}<span class="detail" style="font-weight:300">/ ${esc(s.unit)}</span></span></button>`).join('')}
    </div>`).join('') || '<div class="vide">Aucune prestation.</div>'}
    <button type="button" class="btn plein secondaire" data-new>${icon('plus', 20)} Ajouter une prestation</button>
    <a class="btn plein discret" href="#/modeles">${icon('layers', 20)} Modèles de devis</a>
  </div>`;

  const refresh = () => renderServices(el, params, query);
  el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => editService(store.get('services', b.dataset.id), refresh)));
  el.querySelector('[data-new]').addEventListener('click', () => editService(null, refresh));
}

async function editService(s, refresh) {
  const v = s || { category: 'Community management', name: '', description: '', unit: 'forfait', priceCents: 0 };
  const res = await sheet({
    title: s ? 'Modifier la prestation' : 'Nouvelle prestation',
    html: `<form class="pile" novalidate>
      ${champ({ label: 'Intitulé *', name: 'name', value: v.name, attrs: 'required autocapitalize="sentences" spellcheck="true"' })}
      ${zoneTexte({ label: 'Description', name: 'description', value: v.description })}
      <div class="grille-2">${choix({ label: 'Catégorie', name: 'category', value: v.category, options: CATS })}${choix({ label: 'Unité', name: 'unit', value: v.unit, options: UNITS })}</div>
      ${champ({ label: 'Prix unitaire (€) *', name: 'price', value: centsToInput(v.priceCents), attrs: 'inputmode="decimal"', aide: 'Prix net. TVA non applicable, art. 293 B du CGI.' })}
      <p class="erreur-form liste-erreurs" hidden></p>
      <button type="submit" class="btn plein">Enregistrer</button>
      ${s ? `<button type="button" class="btn plein discret" data-arch>${s.archived ? 'Réactiver' : 'Archiver'}</button>` : ''}
    </form>`,
    bind: (root, close) => {
      const form = root.querySelector('form');
      root.querySelector('[data-arch]')?.addEventListener('click', () => close('arch'));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = formData(form);
        const price = parseEuros(f.price);
        if (!f.name || price === null || price < 0) { const p = form.querySelector('.erreur-form'); p.hidden = false; p.textContent = 'Indiquez un intitulé et un prix valide.'; return; }
        close({ ...f, priceCents: price });
      });
    },
  });
  if (!res) return;
  if (res === 'arch') { await store.put('services', { ...s, archived: !s.archived }); toast(s.archived ? 'Prestation réactivée.' : 'Prestation archivée.'); refresh(); return; }
  const { price, ...rest } = res;
  await store.put('services', { ...v, ...rest, archived: v.archived || false });
  toast('Prestation enregistrée.');
  refresh();
}

/** Lignes d'un modèle → lignes de document (avec remise éventuelle). */
export function templateToLines(t) {
  const lines = [];
  for (const tl of t.lines) {
    const s = store.get('services', tl.serviceId);
    if (!s) continue;
    lines.push({ label: s.name, description: s.description || '', qty: tl.qty, unit: s.unit, priceCents: s.priceCents });
    if (tl.discountPct) {
      lines.push({ label: `Remise ${tl.discountPct} % (${t.name})`, description: '', qty: 1, unit: 'forfait', priceCents: -Math.round(s.priceCents * tl.qty * tl.discountPct / 100) });
    }
  }
  return lines;
}

export function templateTotal(t) {
  return templateToLines(t).reduce((sum, l) => sum + lineTotal(l), 0);
}

export function renderTemplates(el) {
  const list = store.all('templates');
  el.innerHTML = `<div class="pile">
    ${entete('Modèles de devis', { retour: { href: '#/prestations', label: 'Prestations' }, sous: 'Un clic remplit le devis, tout reste modifiable' })}
    <div class="liste">${list.map((t) => `<button type="button" class="element" data-id="${t.id}"><span class="grandit">
        <span class="titre">${esc(t.name)}</span>
        <span class="detail">${esc(templateToLines(t).filter((l) => l.priceCents >= 0).map((l) => `${qtyToText(l.qty)} × ${l.label}`).join(' + '))}</span></span>
        <span class="montant gras" style="font-size:15px">${euros(templateTotal(t))}</span></button>`).join('') || '<div class="vide">Aucun modèle.</div>'}</div>
    <button type="button" class="btn plein secondaire" data-new>${icon('plus', 20)} Créer un modèle</button>
  </div>`;
  const refresh = () => renderTemplates(el);
  el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => editTemplate(store.get('templates', b.dataset.id), refresh)));
  el.querySelector('[data-new]').addEventListener('click', () => editTemplate(null, refresh));
}

async function editTemplate(t, refresh) {
  const v = t || { name: '', lines: [] };
  const services = store.all('services').filter((s) => !s.archived);
  const opts = (sel) => services.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)} (${euros(s.priceCents)})</option>`).join('');
  const lineHtml = (l) => `<div class="ligne" data-l style="align-items:flex-end;gap:8px">
      <label class="champ grandit">Prestation<select name="svc">${opts(l.serviceId)}</select></label>
      <label class="champ" style="width:74px">Qté<input name="qty" inputmode="decimal" value="${qtyToText(l.qty || 1)}"></label>
      <label class="champ" style="width:84px">Remise %<input name="disc" inputmode="numeric" value="${l.discountPct || ''}"></label>
      <button type="button" class="icone-btn" data-rm aria-label="Retirer" style="margin-bottom:3px">${icon('trash', 18)}</button></div>`;
  const res = await sheet({
    title: t ? 'Modifier le modèle' : 'Nouveau modèle',
    html: `<form class="pile" novalidate>
      ${champ({ label: 'Nom du modèle *', name: 'name', value: v.name, attrs: 'required' })}
      <div class="pile" data-lines>${(v.lines.length ? v.lines : [{ serviceId: services[0]?.id, qty: 1 }]).map(lineHtml).join('')}</div>
      <button type="button" class="btn petit discret" data-add>${icon('plus', 18)} Ajouter une ligne</button>
      <p class="erreur-form liste-erreurs" hidden></p>
      <button type="submit" class="btn plein">Enregistrer</button>
      ${t ? '<button type="button" class="btn plein danger" data-suppr>Supprimer le modèle</button>' : ''}
    </form>`,
    bind: (root, close) => {
      const form = root.querySelector('form');
      const box = form.querySelector('[data-lines]');
      const wire = () => box.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { b.closest('[data-l]').remove(); }; });
      wire();
      form.querySelector('[data-add]').addEventListener('click', () => { box.insertAdjacentHTML('beforeend', lineHtml({ serviceId: services[0]?.id, qty: 1 })); wire(); });
      root.querySelector('[data-suppr]')?.addEventListener('click', () => close('suppr'));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.querySelector('[name=name]').value.trim();
        const lines = [...box.querySelectorAll('[data-l]')].map((r) => ({
          serviceId: r.querySelector('[name=svc]').value, qty: parseQty(r.querySelector('[name=qty]').value) || 1,
          discountPct: Math.min(100, Math.max(0, Number(r.querySelector('[name=disc]').value) || 0)),
        }));
        if (!name || !lines.length) { const p = form.querySelector('.erreur-form'); p.hidden = false; p.textContent = 'Donnez un nom et au moins une ligne.'; return; }
        close({ name, lines });
      });
    },
  });
  if (!res) return;
  if (res === 'suppr') {
    if (await confirmer({ title: 'Supprimer ce modèle ?', text: esc(t.name), ok: 'Supprimer', danger: true })) { await store.remove('templates', t.id); toast('Modèle supprimé.'); }
    refresh(); return;
  }
  await store.put('templates', { ...v, ...res });
  toast('Modèle enregistré.');
  refresh();
}
