// Tâches et rappels : 3 priorités en avant, reporter en un geste, récurrence, sous-étapes.

import { store } from '../store.js';
import { esc, todayISO, addDays, dateFR, dateLongue } from '../util.js';
import { icon, toast, sheet, formData, champ, choix, zoneTexte, entete, confirmer } from '../ui.js';
import { completeTask } from '../reminders.js';

const PRIO_ORDER = { haute: 0, normale: 1, basse: 2 };
export const CATEGORIES = ['Administratif', 'Publication', 'Création', 'Tournage', 'Rendez-vous', 'Relance', 'URSSAF', 'Sauvegarde', 'Personnel'];
const ENCOURAGEMENTS = ['Bien joué.', 'Une de moins !', 'Belle avancée.', 'C’est fait, bravo.', 'Parfait, on continue.'];

export function sortTasks(list) {
  return [...list].sort((a, b) =>
    (PRIO_ORDER[a.priority] ?? 1) - (PRIO_ORDER[b.priority] ?? 1)
    || String(a.dueDate || '9').localeCompare(String(b.dueDate || '9'))
    || String(a.dueTime || '99').localeCompare(String(b.dueTime || '99')));
}

export function taskRow(t, { compact = false } = {}) {
  const today = todayISO();
  const client = t.clientId ? store.get('clients', t.clientId)?.name : '';
  const steps = (t.steps || []).length ? `${t.steps.filter((s) => s.done).length} étape${t.steps.length > 1 ? 's' : ''} sur ${t.steps.length}` : '';
  const quand = t.done ? `Fait${t.doneAt ? ' à ' + t.doneAt.slice(11, 16) : ''}`
    : [t.dueDate && t.dueDate < today ? `en retard (${dateFR(t.dueDate)})` : t.dueDate && t.dueDate > today ? dateFR(t.dueDate) : '', t.dueTime].filter(Boolean).join(' ');
  const detail = [quand, t.category, client, steps, t.recurrence !== 'none' && t.recurrence ? '↻' : ''].filter(Boolean).join(' · ');
  return `<div class="element" data-task="${t.id}">
    <input type="checkbox" class="t-case" aria-label="Marquer « ${esc(t.title)} » comme faite" ${t.done ? 'checked' : ''} style="width:26px;height:26px;accent-color:var(--framboise);flex:0 0 auto">
    <button type="button" class="t-ouvrir grandit" style="background:none;border:0;padding:0;text-align:left;cursor:pointer">
      <span class="titre" style="${t.done ? 'text-decoration:line-through;color:var(--encre-douce)' : ''}">${esc(t.title)}</span>
      ${detail ? `<span class="detail">${esc(detail)}</span>` : ''}
    </button>
    ${t.done ? '' : t.priority === 'haute' && !compact ? '<span class="pastille p-framboise">Haute</span>' : ''}
    ${t.done ? '' : `<button type="button" class="lien-btn t-reporter">Reporter</button>`}
  </div>`;
}

/** Branche les cases, l'ouverture et le report sur une liste de tâches. */
export function bindTaskRows(root, refresh) {
  if (!root) return;
  root.querySelectorAll('[data-task]').forEach((row) => {
    const id = row.dataset.task;
    row.querySelector('.t-case').addEventListener('change', async (e) => {
      const t = store.get('tasks', id);
      const before = { ...t };
      await completeTask(t, e.target.checked);
      if (e.target.checked) {
        toast(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)], { undo: async () => { await store.put('tasks', before); refresh(); } });
      }
      refresh();
    });
    row.querySelector('.t-ouvrir').addEventListener('click', () => {
      const t = store.get('tasks', id);
      if (t.link && t.auto) { location.hash = t.link; return; }
      openTaskEditor(t, refresh);
    });
    row.querySelector('.t-reporter')?.addEventListener('click', () => reporter(store.get('tasks', id), refresh));
  });
}

async function reporter(t, refresh) {
  const today = todayISO();
  const h = new Date(); h.setHours(h.getHours() + 2);
  const later = `${String(h.getHours()).padStart(2, '0')}:00`;
  const choice = await sheet({
    title: 'Reporter',
    html: `<div class="pile">
      ${h.getDate() === new Date().getDate() ? `<button type="button" class="btn plein secondaire" data-v="later">Plus tard aujourd'hui (${later})</button>` : ''}
      <button type="button" class="btn plein secondaire" data-v="tomorrow">Demain</button>
      <button type="button" class="btn plein secondaire" data-v="week">Semaine prochaine</button></div>`,
    bind: (root, close) => root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => close(b.dataset.v))),
  });
  if (!choice) return;
  const before = { ...t };
  const patch = choice === 'later' ? { dueDate: today, dueTime: later } : choice === 'tomorrow' ? { dueDate: addDays(today, 1) } : { dueDate: addDays(today, 7) };
  await store.put('tasks', { ...t, ...patch });
  toast('Tâche reportée.', { undo: async () => { await store.put('tasks', before); refresh(); } });
  refresh();
}

/** Formulaire de tâche (création ou modification). */
export async function openTaskEditor(task, refresh) {
  const t = task || { title: '', dueDate: todayISO(), dueTime: '', priority: 'normale', category: 'Administratif', clientId: '', estimateMin: '', steps: [], recurrence: 'none', notes: '' };
  const clients = store.all('clients').filter((c) => !c.archived);
  const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const result = await sheet({
    title: task ? 'Modifier la tâche' : 'Nouvelle tâche',
    html: `<form class="pile" novalidate>
      <div class="ligne" style="align-items:flex-end">
        <div class="grandit">${champ({ label: 'Quoi faire ?', name: 'title', value: t.title, placeholder: 'Ex. : publier le reel du mardi', attrs: 'required autocapitalize="sentences" spellcheck="true"' })}</div>
        ${hasSpeech ? `<button type="button" class="icone-btn" data-dicter aria-label="Dicter la tâche" style="margin-bottom:3px">${icon('mic', 22)}</button>` : ''}
      </div>
      <div class="grille-2">${champ({ label: 'Jour', name: 'dueDate', type: 'date', value: t.dueDate })}${champ({ label: 'Heure (rappel)', name: 'dueTime', type: 'time', value: t.dueTime })}</div>
      <div class="grille-2">
        ${choix({ label: 'Priorité', name: 'priority', value: t.priority, options: [['haute', 'Haute'], ['normale', 'Normale'], ['basse', 'Basse']] })}
        ${choix({ label: 'Catégorie', name: 'category', value: t.category, options: CATEGORIES })}
      </div>
      <div class="grille-2">
        ${choix({ label: 'Client', name: 'clientId', value: t.clientId, options: [['', 'Aucun'], ...clients.map((c) => [c.id, c.name])] })}
        ${choix({ label: 'Répéter', name: 'recurrence', value: t.recurrence, options: [['none', 'Non'], ['daily', 'Chaque jour'], ['weekly', 'Chaque semaine'], ['monthly', 'Chaque mois']] })}
      </div>
      ${champ({ label: 'Durée estimée (minutes)', name: 'estimateMin', type: 'number', value: t.estimateMin || '', attrs: 'inputmode="numeric" min="0"' })}
      ${zoneTexte({ label: 'Petites étapes (une par ligne)', name: 'steps', value: (t.steps || []).map((s) => (s.done ? '[x] ' : '') + s.label).join('\n'), aide: 'Découper aide à commencer. Ex. : relire, vérifier, publier.' })}
      <p class="erreur-form liste-erreurs" hidden></p>
      <button type="submit" class="btn plein">${task ? 'Enregistrer' : 'Ajouter la tâche'}</button>
      ${task ? '<button type="button" class="btn plein danger" data-suppr>Supprimer</button>' : ''}
    </form>`,
    bind: (root, close) => {
      const form = root.querySelector('form');
      root.querySelector('[data-dicter]')?.addEventListener('click', () => dicter(form.querySelector('[name=title]')));
      root.querySelector('[data-suppr]')?.addEventListener('click', () => close('suppr'));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = formData(form);
        if (!f.title) { const p = form.querySelector('.erreur-form'); p.hidden = false; p.textContent = 'Écrivez ce qu’il faut faire.'; return; }
        close(f);
      });
    },
  });
  if (!result) return;
  if (result === 'suppr') {
    if (await confirmer({ title: 'Supprimer la tâche ?', text: esc(task.title), ok: 'Supprimer', danger: true })) {
      await store.remove('tasks', task.id);
      toast('Tâche supprimée.', { undo: async () => { await store.put('tasks', task); refresh(); } });
    }
    refresh(); return;
  }
  const steps = result.steps.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ label: l.replace(/^\[x\]\s*/i, ''), done: /^\[x\]/i.test(l) }));
  await store.put('tasks', { ...t, ...result, steps, estimateMin: Number(result.estimateMin) || 0, done: t.done || false, auto: t.auto || false });
  toast(task ? 'Tâche enregistrée.' : 'Tâche ajoutée.');
  refresh();
}

function dicter(input) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.interimResults = false;
  rec.onresult = (e) => { input.value = e.results[0][0].transcript; input.focus(); };
  rec.onerror = () => toast('Dictée indisponible. Utilisez le micro du clavier.');
  rec.start();
  toast('Je vous écoute…', { duration: 2500 });
}

export function render(el, params, query = {}) {
  const onglet = query.vue || 'jour';
  const today = todayISO();
  const all = store.all('tasks');
  let list;
  if (onglet === 'jour') list = sortTasks(all.filter((t) => !t.done && (!t.dueDate || t.dueDate <= today)));
  else if (onglet === 'avenir') list = all.filter((t) => !t.done && t.dueDate > today).sort((a, b) => (a.dueDate + (a.dueTime || '')).localeCompare(b.dueDate + (b.dueTime || '')));
  else list = all.filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 50);

  const top = onglet === 'jour' ? list.slice(0, 3) : [];
  const rest = onglet === 'jour' ? list.slice(3) : list;
  const doneToday = all.filter((t) => t.done && t.doneAt && t.doneAt.slice(0, 10) === today).length;

  let groups = '';
  if (onglet === 'avenir') {
    const byDay = {};
    for (const t of rest) (byDay[t.dueDate] = byDay[t.dueDate] || []).push(t);
    groups = Object.keys(byDay).map((d) => `<span class="etiquette">${esc(dateLongue(d))}</span><div class="liste">${byDay[d].map((t) => taskRow(t)).join('')}</div>`).join('');
  }

  el.innerHTML = `<div class="pile">
    ${entete('Tâches et rappels', { retour: { href: '#/plus', label: 'Plus' } })}
    <div class="seg" role="tablist">
      <a href="#/taches?vue=jour" role="tab" class="${onglet === 'jour' ? 'actif' : ''}">Aujourd'hui</a>
      <a href="#/taches?vue=avenir" role="tab" class="${onglet === 'avenir' ? 'actif' : ''}">À venir</a>
      <a href="#/taches?vue=fait" role="tab" class="${onglet === 'fait' ? 'actif' : ''}">Fait</a>
    </div>
    ${onglet === 'jour' && doneToday ? `<div class="carte-voile ligne petit" style="color:#5A2A33">${icon('heart', 18)} ${doneToday} tâche${doneToday > 1 ? 's' : ''} faite${doneToday > 1 ? 's' : ''} aujourd'hui. Belle avancée.</div>` : ''}
    <div id="taches" class="pile">
      ${onglet === 'jour' ? `<div class="entre"><span class="etiquette">Mes 3 priorités</span></div>
        <div class="liste">${top.map((t) => taskRow(t)).join('') || '<div class="vide">Rien à faire pour l’instant.</div>'}</div>
        ${rest.length ? `<details><summary class="petit" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Voir les ${rest.length} autres</summary><div class="liste" style="margin-top:8px">${rest.map((t) => taskRow(t)).join('')}</div></details>` : ''}`
        : onglet === 'avenir' ? (groups || '<div class="vide">Aucune tâche prévue.</div>')
        : `<div class="liste">${rest.map((t) => taskRow(t)).join('') || '<div class="vide">Aucune tâche faite pour l’instant.</div>'}</div>`}
    </div>
    <p class="tres-petit doux">Les rappels s'affichent quand l'application est ouverte. Pour une alerte même appli fermée, ajoutez l'événement à votre calendrier iPhone depuis l'Agenda.</p>
  </div>`;

  const refresh = () => render(el, params, query);
  bindTaskRows(el.querySelector('#taches'), refresh);
  const fab = document.getElementById('fab');
  fab.onclick = (e) => { e.preventDefault(); openTaskEditor(null, refresh); };
}
