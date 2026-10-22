// Outils communs : échappement HTML, montants en centimes, dates, identifiants.
// Tous les montants sont stockés en CENTIMES (nombres entiers) pour éviter
// les erreurs d'arrondi : 390,00 € = 39000.

/** Échappe un texte avant de l'insérer dans du HTML (protège contre l'injection). */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Identifiant unique (UUID quand le navigateur le permet). */
export function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const euroFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

/** 39000 → "390,00 €" (espaces insécables remplacés par des espaces fines lisibles). */
export function euros(cents) {
  return euroFmt.format((Number(cents) || 0) / 100).replace(/ /g, ' ');
}

/** "390,50" ou "390.5" → 39050. Renvoie null si la saisie n'est pas un nombre. */
export function parseEuros(text) {
  if (text === null || text === undefined) return null;
  const clean = String(text).replace(/\s|€/g, '').replace(',', '.');
  if (clean === '') return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Centimes → texte modifiable dans un champ : 39050 → "390,50". */
export function centsToInput(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2).replace('.', ',');
}

/** Quantité saisie ("1,5") → nombre (1.5). */
export function parseQty(text) {
  const n = Number(String(text ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function qtyToText(q) {
  return String(Math.round(q * 100) / 100).replace('.', ',');
}

/** Total d'une ligne en centimes, arrondi au centime. */
export function lineTotal(line) {
  return Math.round(parseQty(line.qty) * (Number(line.priceCents) || 0));
}

/** Pourcentage d'un montant, arrondi au centime. */
export function percentOf(cents, pct) {
  return Math.round((Number(cents) || 0) * (Number(pct) || 0) / 100);
}

// ---------- Dates (format AAAA-MM-JJ, heure locale) ----------

export function todayISO() {
  return toISODate(new Date());
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const d = parseISODate(iso) || new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return toISODate(d);
}

export function addMonths(iso, months) {
  const d = parseISODate(iso) || new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
}

export function daysBetween(fromIso, toIso) {
  const a = parseISODate(fromIso), b = parseISODate(toIso);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** "2026-10-22" → "22/10/2026" */
export function dateFR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-10-22" → "jeudi 22 octobre" */
export function dateLongue(iso, withYear = false) {
  const d = parseISODate(iso);
  if (!d) return '';
  const txt = `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function moisAnnee(iso) {
  const d = parseISODate(iso);
  return d ? `${mois[d.getMonth()]} ${d.getFullYear()}` : '';
}

export function jourCourt(d) {
  return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()];
}

/** Heure "HH:MM" d'une date-heure locale "AAAA-MM-JJTHH:MM". */
export function heure(dt) {
  return dt && dt.length >= 16 ? dt.slice(11, 16) : '';
}

export function nowLocalDT() {
  const d = new Date();
  return `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Initiales pour les pastilles (« Boulangerie Martin » → « BM »). */
export function initiales(nom) {
  const mots = String(nom || '?').replace(/[^\p{L}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return (mots[0][0] + (mots[1] ? mots[1][0] : '')).toUpperCase();
}

/** Supprime les accents et met en minuscules, pour la recherche. */
export function norm(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Garde uniquement les chiffres (SIREN, SIRET, téléphone). */
export function digits(text) {
  return String(text || '').replace(/\D/g, '');
}

export function formatSiret(text) {
  const d = digits(text);
  if (d.length === 14) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return text || '';
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
