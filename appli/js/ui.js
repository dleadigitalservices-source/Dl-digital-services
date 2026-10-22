// Éléments d'interface réutilisables : icônes, messages, fenêtres du bas, confirmations.

import { esc } from './util.js';

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  file: '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  filePlus: '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M12 11v6M9 14h6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  heart: '<path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
};

export function icon(name, size = 22, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ''}</svg>`;
}

export function pill(status) {
  return `<span class="pastille ${status.cls}">${esc(status.label)}</span>`;
}

// ---------- Messages (« toasts ») avec bouton Annuler ----------
export function toast(message, { undo = null, duration = 4500 } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button type="button">Annuler</button>' : ''}`;
  root.appendChild(el);
  let done = false;
  const close = () => { if (!done) { done = true; el.remove(); } };
  if (undo) el.querySelector('button').addEventListener('click', () => { close(); undo(); });
  setTimeout(close, duration);
}

// ---------- Fenêtre du bas (« feuille ») ----------
let openSheet = null;

/**
 * Ouvre une feuille. `render(close)` renvoie le HTML ; `bind(root, close)` branche les actions.
 * Renvoie une promesse résolue à la fermeture avec la valeur passée à close().
 */
export function sheet({ title = '', html = '', bind = null, label = '' }) {
  closeSheet();
  return new Promise((resolve) => {
    const root = document.getElementById('sheet-root');
    const wrap = document.createElement('div');
    wrap.className = 'voile-fond';
    wrap.innerHTML = `<div class="feuille" role="dialog" aria-modal="true" aria-label="${esc(label || title)}">
      <div class="poignee"></div>
      ${title ? `<div class="entre" style="margin-bottom:12px"><h2>${esc(title)}</h2><button type="button" class="icone-btn" data-close aria-label="Fermer">${icon('close', 18)}</button></div>` : ''}
      <div class="feuille-contenu">${html}</div></div>`;
    root.appendChild(wrap);
    const close = (value) => {
      if (!wrap.isConnected) return;
      wrap.remove();
      openSheet = null;
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(null); });
    openSheet = close;
    if (bind) bind(wrap.querySelector('.feuille-contenu'), close);
    const first = wrap.querySelector('input, select, textarea, button:not([data-close])');
    if (first && first.tagName !== 'BUTTON') setTimeout(() => first.focus(), 50);
  });
}

export function closeSheet() { if (openSheet) openSheet(null); }

/** Confirmation claire avant une action importante. */
export function confirmer({ title, text, ok = 'Confirmer', danger = false }) {
  return sheet({
    title,
    html: `<div class="pile"><p style="margin:0">${text}</p>
      <button type="button" class="btn plein ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button>
      <button type="button" class="btn plein discret" data-close>Annuler</button></div>`,
    bind: (root, close) => root.querySelector('[data-ok]').addEventListener('click', () => close(true)),
  });
}

/** Lit les champs d'un formulaire en objet { name: value }. */
export function formData(root) {
  const out = {};
  root.querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  });
  return out;
}

/** Champ texte prêt à l'emploi. */
export function champ({ label, name, value = '', type = 'text', placeholder = '', aide = '', attrs = '' }) {
  return `<label class="champ">${esc(label)}
    <input type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}>
    ${aide ? `<span class="aide">${esc(aide)}</span>` : ''}</label>`;
}

export function zoneTexte({ label, name, value = '', placeholder = '', aide = '' }) {
  return `<label class="champ">${esc(label)}
    <textarea name="${name}" placeholder="${esc(placeholder)}" spellcheck="true" autocorrect="on">${esc(value)}</textarea>
    ${aide ? `<span class="aide">${esc(aide)}</span>` : ''}</label>`;
}

export function choix({ label, name, value = '', options = [] }) {
  return `<label class="champ">${esc(label)}<select name="${name}">
    ${options.map((o) => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(t)}</option>`;
    }).join('')}</select></label>`;
}

/** En-tête de page avec retour optionnel. */
export function entete(titre, { retour = null, sous = '', droite = '' } = {}) {
  return `${retour ? `<a class="retour" href="${retour.href}">${icon('back', 20)}${esc(retour.label)}</a>` : ''}
  <div class="entete"><div><h1>${titre}</h1>${sous ? `<div class="sous-titre">${sous}</div>` : ''}</div>${droite}</div>`;
}

/** Partage via le menu de l'iPhone, sinon copie dans le presse-papiers. */
export async function partagerTexte(title, text) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); toast('Texte copié : collez-le dans votre e-mail.'); }
  catch { toast('Copie impossible sur cet appareil.'); }
}

/** Télécharge un fichier généré (export, calendrier). */
export function telecharger(nom, contenu, type) {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
