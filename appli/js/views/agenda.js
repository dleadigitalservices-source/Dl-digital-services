// Agenda : vues jour, semaine, mois ; couleurs par type ; rappels ; export vers l'iPhone.

import { store } from '../store.js';
import { esc, todayISO, addDays, parseISODate, toISODate, jourCourt, heure, dateLongue, moisAnnee } from '../util.js';
import { icon, toast, sheet, formData, champ, choix, zoneTexte, confirmer, telecharger } from '../ui.js';
import { icsForEvents } from '../reminders.js';

export const TYPES = {
  rdv: ['Rendez-vous client', 'var(--type-rdv)'],
  appel: ['Appel', 'var(--type-appel)'],
  publication: ['Publication', 'var(--type-publication)'],
  tournage: ['Tournage', 'var(--type-tournage)'],
  admin: ['Administratif', 'var(--type-admin)'],
  perso: ['Personnel', 'var(--type-perso)'],
};

function startOfWeek(iso) {
  const d = parseISODate(iso);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

function reminderLabel(min) {
  if (min > 120) return 'la veille à 18 h';
  if (min === 60) return '1 h avant';
  return `${min} min avant`;
}

function eventRow(ev) {
  const [label, color] = TYPES[ev.type] || TYPES.rdv;
  const client = ev.clientId ? store.get('clients', ev.clientId)?.name : '';
  const past = new Date(ev.start).getTime() + (ev.durationMin || 30) * 60000 < Date.now();
  return `<div class="ligne" style="align-items:stretch">
    <span style="width:48px;flex:0 0 auto;padding-top:12px;font-size:15px;font-weight:400;color:var(--encre-douce)">${heure(ev.start)}</span>
    <button type="button" class="element grandit" data-ev="${ev.id}" style="flex-direction:column;align-items:flex-start;gap:3px;${past ? 'opacity:.6' : ''}">
      <span class="titre ligne" style="gap:8px"><span class="point" style="background:${color}"></span>${esc(ev.title)}</span>
      <span class="detail">${esc([label, client, ev.place, ev.durationMin ? `${ev.durationMin} min` : ''].filter(Boolean).join(' · '))}</span>
      ${(ev.reminders || []).length ? `<span class="detail ligne" style="gap:6px">${icon('bell', 15)} Rappel ${esc(ev.reminders.map(reminderLabel).join(', '))}</span>` : ''}
    </button></div>`;
}

export function render(el, params, query = {}) {
  const vue = query.vue || 'jour';
  const day = query.d || todayISO();
  const today = todayISO();
  const events = store.all('events');
  const ofDay = (d) => events.filter((e) => e.start.slice(0, 10) === d).sort((a, b) => a.start.localeCompare(b.start));
  const href = (d, v = vue) => `#/agenda?vue=${v}&d=${d}`;

  const weekStart = startOfWeek(day);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const strip = `<div class="entre">
      <a class="icone-btn" href="${href(addDays(day, vue === 'mois' ? -30 : -7))}" aria-label="Période précédente">${icon('back', 18)}</a>
      <span class="gras" style="font-family:var(--titre);font-size:18px">${esc(moisAnnee(day).replace(/^./, (c) => c.toUpperCase()))}</span>
      <a class="icone-btn" href="${href(addDays(day, vue === 'mois' ? 30 : 7))}" aria-label="Période suivante">${icon('chevron', 18)}</a></div>`;

  let body = '';
  if (vue === 'mois') {
    const d0 = parseISODate(day); const first = toISODate(new Date(d0.getFullYear(), d0.getMonth(), 1));
    const gridStart = startOfWeek(first);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    body = `<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j) => `<span class="tres-petit doux">${j}</span>`).join('')}
      ${cells.map((c) => {
        const evs = ofDay(c); const inMonth = c.slice(5, 7) === day.slice(5, 7);
        return `<a href="${href(c, 'jour')}" style="text-decoration:none;color:inherit;border-radius:12px;padding:6px 0;min-height:52px;display:flex;flex-direction:column;align-items:center;gap:4px;${c === today ? 'background:var(--framboise);color:var(--ivoire)' : 'background:var(--blanc)'};${inMonth ? '' : 'opacity:.4'}">
          <span style="font-size:15px">${Number(c.slice(8))}</span>
          <span style="display:flex;gap:2px">${evs.slice(0, 3).map((e) => `<span class="point" style="width:6px;height:6px;background:${c === today ? 'var(--ivoire)' : (TYPES[e.type] || TYPES.rdv)[1]}"></span>`).join('')}</span></a>`;
      }).join('')}</div>`;
  } else {
    const weekStrip = `<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">
      ${week.map((d) => {
        const dt = parseISODate(d); const sel = d === day; const has = ofDay(d).length;
        return `<a href="${href(d)}" style="text-decoration:none;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;border-radius:14px;${sel ? 'background:var(--framboise);color:var(--ivoire)' : 'color:var(--encre)'}" ${sel ? 'aria-current="date"' : ''}>
          <span class="tres-petit" style="${sel ? '' : 'color:var(--encre-douce)'}">${jourCourt(dt)}</span>
          <span style="font-size:17px;font-weight:${d === today ? 600 : 400}">${dt.getDate()}</span>
          <span class="point" style="width:5px;height:5px;background:${has ? (sel ? 'var(--ivoire)' : 'var(--framboise-clair)') : 'transparent'}"></span></a>`;
      }).join('')}</div>`;
    if (vue === 'semaine') {
      body = weekStrip + week.map((d) => {
        const evs = ofDay(d);
        return evs.length ? `<span class="etiquette">${esc(dateLongue(d))}</span><div class="liste">${evs.map(eventRow).join('')}</div>` : '';
      }).join('') || '<div class="vide">Aucun événement cette semaine.</div>';
    } else {
      const evs = ofDay(day);
      body = `${weekStrip}<span class="etiquette">${esc(dateLongue(day))}</span>
        <div class="liste">${evs.map(eventRow).join('') || '<div class="vide">Rien de prévu ce jour-là.</div>'}</div>`;
    }
  }

  el.innerHTML = `<div class="pile">
    <div class="entete"><div><div class="sous-titre">${esc(dateLongue(today))}</div><h1>Agenda</h1></div>
      <div class="seg" role="group" aria-label="Affichage">
        <a href="${href(day, 'jour')}" class="${vue === 'jour' ? 'actif' : ''}">Jour</a>
        <a href="${href(day, 'semaine')}" class="${vue === 'semaine' ? 'actif' : ''}">Semaine</a>
        <a href="${href(day, 'mois')}" class="${vue === 'mois' ? 'actif' : ''}">Mois</a>
      </div></div>
    ${strip}
    <div class="ligne" style="flex-wrap:wrap;gap:6px 14px">${Object.values(TYPES).map(([l, c]) => `<span class="ligne tres-petit" style="gap:6px"><span class="point" style="background:${c}"></span>${l}</span>`).join('')}</div>
    ${body}
    ${day !== today ? `<a class="petit" href="${href(today)}">Revenir à aujourd'hui</a>` : ''}
    <button type="button" class="btn discret plein" data-export>${icon('download', 20)} Ajouter les 30 prochains jours à mon calendrier iPhone</button>
  </div>`;

  const refresh = () => render(el, params, query);
  el.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => openEvent(store.get('events', b.dataset.ev), refresh)));
  el.querySelector('[data-export]').addEventListener('click', () => {
    const until = addDays(today, 30);
    const list = events.filter((e) => e.start.slice(0, 10) >= today && e.start.slice(0, 10) <= until);
    if (!list.length) { toast('Aucun événement à exporter.'); return; }
    telecharger('agenda-dl-digital-services.ics', icsForEvents(list), 'text/calendar');
    toast('Ouvrez le fichier, puis « Tout ajouter » dans votre calendrier.');
  });
  document.getElementById('fab').onclick = (e) => { e.preventDefault(); openEventEditor(null, refresh, day); };
}

async function openEvent(ev, refresh) {
  const [label, color] = TYPES[ev.type] || TYPES.rdv;
  const client = ev.clientId ? store.get('clients', ev.clientId) : null;
  const action = await sheet({
    title: ev.title,
    html: `<div class="pile">
      <div class="ligne petit"><span class="point" style="background:${color}"></span>${esc(label)}</div>
      <div class="carte pile" style="gap:6px">
        <div>${esc(dateLongue(ev.start.slice(0, 10), true))} à ${heure(ev.start)}${ev.durationMin ? ` · ${ev.durationMin} min` : ''}</div>
        ${client ? `<a href="#/client/${client.id}">${esc(client.name)}</a>` : ''}
        ${ev.place ? `<div class="doux">${esc(ev.place)}</div>` : ''}
        ${ev.notes ? `<div style="white-space:pre-line">${esc(ev.notes)}</div>` : ''}
        ${(ev.reminders || []).length ? `<div class="petit doux">Rappels : ${esc(ev.reminders.map(reminderLabel).join(', '))}</div>` : ''}
      </div>
      <button type="button" class="btn plein" data-v="ics">${icon('calendar', 20)} Ajouter à mon calendrier iPhone</button>
      <button type="button" class="btn plein secondaire" data-v="edit">Modifier</button>
      <button type="button" class="btn plein discret" data-v="dup">Dupliquer</button>
    </div>`,
    bind: (root, close) => root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => close(b.dataset.v))),
  });
  if (action === 'ics') {
    telecharger(`${ev.title.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}.ics`, icsForEvents([ev]), 'text/calendar');
    toast('Ouvrez le fichier puis « Ajouter » : l’iPhone vous préviendra aux heures prévues.');
  }
  if (action === 'edit') openEventEditor(ev, refresh);
  if (action === 'dup') { const { id, createdAt, updatedAt, ...rest } = ev; openEventEditor({ ...rest, title: ev.title }, refresh, null, true); }
}

function computeReminders(f) {
  const out = [];
  if (f.r_veille) {
    const start = new Date(`${f.date}T${f.time}`);
    const eve = new Date(start); eve.setDate(eve.getDate() - 1); eve.setHours(18, 0, 0, 0);
    const min = Math.round((start - eve) / 60000);
    if (min > 120) out.push(min);
  }
  if (f.r_60) out.push(60);
  if (f.r_30) out.push(30);
  if (f.r_15) out.push(15);
  return out;
}

export async function openEventEditor(ev, refresh, day = null, duplicate = false) {
  const isNew = !ev || duplicate;
  const e = ev || { title: '', type: 'rdv', clientId: '', start: `${day || todayISO()}T10:00`, durationMin: 60, place: '', notes: '', reminders: [1080, 60] };
  const has = (fn) => (e.reminders || []).some(fn);
  const clients = store.all('clients').filter((c) => !c.archived);
  const result = await sheet({
    title: isNew ? 'Nouvel événement' : 'Modifier l’événement',
    html: `<form class="pile" novalidate>
      ${champ({ label: 'Titre', name: 'title', value: e.title, placeholder: 'Ex. : appel découverte', attrs: 'required autocapitalize="sentences" spellcheck="true"' })}
      <div class="grille-2">${choix({ label: 'Type', name: 'type', value: e.type, options: Object.entries(TYPES).map(([k, [l]]) => [k, l]) })}
        ${choix({ label: 'Client', name: 'clientId', value: e.clientId, options: [['', 'Aucun'], ...clients.map((c) => [c.id, c.name])] })}</div>
      <div class="grille-2">${champ({ label: 'Date', name: 'date', type: 'date', value: e.start.slice(0, 10) })}${champ({ label: 'Heure', name: 'time', type: 'time', value: heure(e.start) || '10:00' })}</div>
      <div class="grille-2">${champ({ label: 'Durée (min)', name: 'durationMin', type: 'number', value: e.durationMin, attrs: 'inputmode="numeric" min="0" step="5"' })}
        ${champ({ label: 'Lieu ou lien visio', name: 'place', value: e.place })}</div>
      ${zoneTexte({ label: 'Notes', name: 'notes', value: e.notes })}
      <fieldset class="pile" style="border:0;padding:0;margin:0;gap:4px"><legend class="etiquette" style="margin-bottom:6px">Me prévenir</legend>
        <label class="case"><input type="checkbox" name="r_veille" ${has((m) => m > 120) ? 'checked' : ''}>La veille à 18 h</label>
        <label class="case"><input type="checkbox" name="r_60" ${has((m) => m === 60) ? 'checked' : ''}>1 h avant</label>
        <label class="case"><input type="checkbox" name="r_30" ${has((m) => m === 30) ? 'checked' : ''}>30 min avant</label>
        <label class="case"><input type="checkbox" name="r_15" ${has((m) => m === 15) ? 'checked' : ''}>15 min avant</label>
      </fieldset>
      <p class="erreur-form liste-erreurs" hidden></p>
      <button type="submit" class="btn plein">${isNew ? 'Ajouter' : 'Enregistrer'}</button>
      ${!isNew ? '<button type="button" class="btn plein danger" data-suppr>Supprimer</button>' : ''}
    </form>`,
    bind: (root, close) => {
      const form = root.querySelector('form');
      root.querySelector('[data-suppr]')?.addEventListener('click', () => close('suppr'));
      form.addEventListener('submit', (evt) => {
        evt.preventDefault();
        const f = formData(form);
        if (!f.title || !f.date || !f.time) { const p = form.querySelector('.erreur-form'); p.hidden = false; p.textContent = 'Indiquez au moins un titre, une date et une heure.'; return; }
        close(f);
      });
    },
  });
  if (!result) return;
  if (result === 'suppr') {
    if (await confirmer({ title: 'Supprimer l’événement ?', text: esc(e.title), ok: 'Supprimer', danger: true })) {
      await store.remove('events', e.id);
      toast('Événement supprimé.', { undo: async () => { await store.put('events', ev); refresh(); } });
    }
    refresh(); return;
  }
  const saved = { ...(duplicate ? {} : e), title: result.title, type: result.type, clientId: result.clientId, start: `${result.date}T${result.time}`, durationMin: Number(result.durationMin) || 0, place: result.place, notes: result.notes, reminders: computeReminders(result) };
  if (duplicate) delete saved.id;
  await store.put('events', saved);
  toast(isNew ? 'Événement ajouté.' : 'Événement enregistré.');
  refresh();
}
