// Rappels et tâches automatiques.
//
// V1 : les rappels s'affichent dans l'application quand elle est ouverte, et
// chaque événement peut être ajouté au calendrier de l'iPhone (fichier .ics avec
// alarmes) pour recevoir les alertes natives même application fermée.
// Les notifications envoyées par le serveur arriveront avec Supabase (V2).

import { store } from './store.js';
import { invoiceStatus, quoteStatus, docTotals, isInvoiceKind } from './legal.js';
import { todayISO, addDays, daysBetween, euros, toISODate, nowLocalDT, heure } from './util.js';
import { toast } from './ui.js';

// ---------- Encaissements (pour l'URSSAF et l'accueil) ----------
export function encaisse(fromIso, toIso) {
  return store.all('payments')
    .filter((p) => p.date >= fromIso && p.date <= toIso)
    .reduce((s, p) => s + (Number(p.amountCents) || 0), 0);
}

function lastDayOfMonth(y, m) { return toISODate(new Date(y, m + 1, 0)); }

/** Période URSSAF à déclarer ce mois-ci (la précédente). */
export function urssafPeriod(today = todayISO()) {
  const [y, m] = today.split('-').map(Number); // m : 1..12
  const rhythm = store.settings.urssafRhythm;
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  if (rhythm === 'trimestriel') {
    if (![1, 4, 7, 10].includes(m)) return null;
    const qEndMonth = m - 1 === 0 ? 12 : m - 1;
    const qy = m === 1 ? y - 1 : y;
    const from = toISODate(new Date(qy, qEndMonth - 3, 1));
    const to = lastDayOfMonth(qy, qEndMonth - 1);
    const q = Math.ceil(qEndMonth / 3);
    return { key: `${qy}-T${q}`, label: `${q}e trimestre ${qy}`, from, to, deadline: lastDayOfMonth(y, m - 1) };
  }
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return { key: `${py}-${String(pm).padStart(2, '0')}`, label: `${mois[pm - 1]} ${py}`, from: toISODate(new Date(py, pm - 1, 1)), to: lastDayOfMonth(py, pm - 1), deadline: lastDayOfMonth(y, m - 1) };
}

// ---------- Tâches créées automatiquement ----------
async function ensureTask(id, fields) {
  if (store.get('tasks', id)) return;
  await store.put('tasks', {
    id, clientId: '', dueDate: todayISO(), dueTime: '', priority: 'haute', category: 'Administratif',
    estimateMin: 10, steps: [], recurrence: 'none', done: false, doneAt: null, auto: true, ...fields,
  });
}

export async function runAutoTasks() {
  const today = todayISO();
  const docs = store.all('documents');

  for (const d of docs) {
    if (!d.number) continue;
    const client = d.clientSnapshot?.name || '';
    if (isInvoiceKind(d.kind)) {
      const st = invoiceStatus(d);
      if (st.code === 'en_retard' || (st.code === 'partiel' && d.dueDate < today)) {
        const late = daysBetween(d.dueDate, today);
        const step = late >= 15 ? 3 : late >= 7 ? 2 : 1;
        const label = ['', 'premier rappel courtois', 'deuxième rappel', 'dernier rappel avant mise en demeure'][step];
        await ensureTask(`relance-${d.id}-${step}`, {
          title: `Relancer ${d.number} (${client}) : ${label}`, clientId: d.clientId,
          link: `#/document/${d.id}`, category: 'Relance',
        });
      }
    }
    if (d.kind === 'quote' && quoteStatus(d).code === 'envoye' && daysBetween(d.issueDate, today) >= 7) {
      await ensureTask(`relance-devis-${d.id}`, {
        title: `Relancer le devis ${d.number} (${client}), sans réponse depuis 7 jours`, clientId: d.clientId,
        link: `#/document/${d.id}`, priority: 'normale', category: 'Relance',
      });
    }
  }

  const period = urssafPeriod(today);
  if (period) {
    const amount = encaisse(period.from, period.to);
    await ensureTask(`urssaf-${period.key}`, {
      title: `Déclarer le chiffre d'affaires de ${period.label} à l'URSSAF : ${euros(amount)}`,
      dueDate: period.deadline, priority: 'haute', category: 'URSSAF', link: '#/paiements',
    });
  }

  const monthKey = today.slice(0, 7);
  await ensureTask(`export-${monthKey}`, {
    title: 'Sauvegarder mes données (Réglages › Exporter)', dueDate: today, priority: 'normale',
    category: 'Sauvegarde', link: '#/reglages', estimateMin: 2,
  });
}

/** Tâche faite : si elle se répète, crée automatiquement la suivante. */
export async function completeTask(task, done = true) {
  const updated = { ...task, done, doneAt: done ? nowLocalDT() : null };
  await store.put('tasks', updated);
  if (done && task.recurrence && task.recurrence !== 'none' && !task.nextCreated) {
    const step = { daily: 1, weekly: 7 }[task.recurrence];
    let next = step ? addDays(task.dueDate || todayISO(), step) : null;
    if (task.recurrence === 'monthly') {
      const d = new Date(task.dueDate || todayISO()); d.setMonth(d.getMonth() + 1); next = toISODate(d);
    }
    const { id, createdAt, updatedAt, ...rest } = task;
    await store.put('tasks', { ...rest, dueDate: next, done: false, doneAt: null, steps: (task.steps || []).map((s) => ({ ...s, done: false })) });
    await store.put('tasks', { ...updated, nextCreated: true });
  }
}

// ---------- Rappels pendant que l'application est ouverte ----------
const KEY = 'dl-rappels-vus';
function seen() { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); } }
function markSeen(set) { try { localStorage.setItem(KEY, JSON.stringify([...set].slice(-300))); } catch { /* stockage indisponible */ } }

function notify(text) {
  toast(text, { duration: 9000 });
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(120);
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('DL Digital Services', { body: text, icon: 'icons/icon-192.png' });
  } catch { /* non disponible sur cet appareil */ }
}

// Un rappel n'est affiché que dans les 20 minutes qui suivent son heure :
// on évite ainsi une avalanche de vieux rappels à l'ouverture de l'application.
const WINDOW = 20 * 60000;

function check() {
  if (!store.state) return;
  const now = Date.now();
  const vus = seen();
  const due = [];
  for (const ev of store.all('events')) {
    const start = new Date(ev.start).getTime();
    for (const min of ev.reminders || []) {
      const fireAt = start - min * 60000;
      const key = `ev-${ev.id}-${min}-${ev.start}`;
      if (!vus.has(key) && now >= fireAt && now - fireAt < WINDOW) {
        vus.add(key);
        due.push(`${ev.title} à ${heure(ev.start)}${min > 120 ? ' (demain)' : ''}`);
      }
    }
  }
  for (const t of store.all('tasks')) {
    if (t.done || !t.dueTime || !t.dueDate) continue;
    const at = new Date(`${t.dueDate}T${t.dueTime}`).getTime();
    const key = `t-${t.id}-${t.dueDate}-${t.dueTime}`;
    if (!vus.has(key) && now >= at && now - at < WINDOW) {
      vus.add(key);
      due.push(t.title);
    }
  }
  markSeen(vus);
  if (due.length === 1) notify(`Rappel : ${due[0]}`);
  else if (due.length > 1) notify(`${due.length} rappels : ${due.join(' · ')}`);
}

let timer = null;
export function startReminders() {
  clearInterval(timer);
  check();
  timer = setInterval(check, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}

// ---------- Fichiers calendrier (.ics) avec alarmes ----------
function icsDate(localDT) {
  return localDT.replace(/[-:]/g, '').slice(0, 13) + '00';
}
function icsText(t) {
  return String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
}

export function icsForEvents(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DL Digital Services//Gestion//FR', 'CALSCALE:GREGORIAN'];
  for (const ev of events) {
    const startMs = new Date(ev.start).getTime();
    const end = new Date(startMs + (ev.durationMin || 30) * 60000);
    const endDT = `${toISODate(end)}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@dl-digital-services`, `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(ev.start)}`, `DTEND:${icsDate(endDT)}`, `SUMMARY:${icsText(ev.title)}`);
    if (ev.place) lines.push(`LOCATION:${icsText(ev.place)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${icsText(ev.notes)}`);
    for (const min of ev.reminders || []) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(ev.title)}`, `TRIGGER:-PT${min}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function totalDue(doc) { return docTotals(doc).due; }
