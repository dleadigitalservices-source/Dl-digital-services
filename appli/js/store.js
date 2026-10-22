// Couche de données : une seule porte d'entrée pour lire et écrire.
//
// Deux « adaptateurs » de stockage, interchangeables :
//   - LocalAdapter    : IndexedDB, dans le navigateur (mode démo / hors ligne).
//   - SupabaseAdapter : base de données sécurisée en Europe, avec connexion.
// Le reste de l'application ne sait pas lequel est utilisé.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { uid, deepClone } from './util.js';

export const COLLECTIONS = ['clients', 'services', 'templates', 'documents', 'payments', 'events', 'tasks'];

export const DEFAULT_SETTINGS = {
  firstName: '', lastName: '', tradeName: 'DL Digital Services',
  address: '', postcode: '', city: '',
  siret: '', ape: '', email: 'dlea.digitalservices@gmail.com', phone: '06 99 49 39 30',
  iban: '', bic: '',
  vatMention: 'TVA non applicable, art. 293 B du CGI',
  latePenalty: 'Pénalités de retard : 3 fois le taux d’intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €. Pas d’escompte en cas de paiement anticipé.',
  paymentDays: 30, depositPct: 50, quoteValidityDays: 30,
  paymentTerms: 'Virement bancaire',
  rcPro: '', mediator: '', cgv: '',
  urssafRhythm: 'mensuel',
  invoicePrefix: 'FAC', quotePrefix: 'DEV', creditPrefix: 'AV',
  reminderMorning: '08:30',
  bigText: false, dysFont: false,
};

// ---------------------------------------------------------------------------
// Adaptateur local (IndexedDB)
// ---------------------------------------------------------------------------
class LocalAdapter {
  constructor() { this.name = 'local'; this.dbp = null; }

  open() {
    if (this.dbp) return this.dbp;
    this.dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('dl-gestion', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbp;
  }

  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async set(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadAll() {
    const out = {};
    for (const c of COLLECTIONS) out[c] = (await this.get(c)) || [];
    out.settings = (await this.get('settings')) || null;
    out.counters = (await this.get('counters')) || {};
    out.meta = (await this.get('meta')) || null;
    return out;
  }

  async saveCollection(name, items) { await this.set(name, items); }
  async saveItem(name, item, all) { await this.set(name, all); }
  async removeItem(name, id, all) { await this.set(name, all); }
  async saveSingle(key, value) { await this.set(key, value); }
}

// ---------------------------------------------------------------------------
// Adaptateur Supabase (table « records » protégée par Row Level Security)
// ---------------------------------------------------------------------------
class SupabaseAdapter {
  constructor(client) { this.name = 'supabase'; this.client = client; }

  async loadAll() {
    const { data, error } = await this.client.from('records').select('id, kind, data');
    if (error) throw error;
    const out = { counters: {}, settings: null, meta: null };
    for (const c of COLLECTIONS) out[c] = [];
    for (const row of data) {
      if (COLLECTIONS.includes(row.kind)) out[row.kind].push(row.data);
      else if (row.kind === 'settings') out.settings = row.data;
      else if (row.kind === 'counters') out.counters = row.data;
      else if (row.kind === 'meta') out.meta = row.data;
    }
    return out;
  }

  async upsert(kind, id, data) {
    const { error } = await this.client.from('records').upsert({ id, kind, data, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  async saveCollection(name, items) { for (const it of items) await this.upsert(name, it.id, it); }
  async saveItem(name, item) { await this.upsert(name, item.id, item); }
  async removeItem(name, id) {
    const { error } = await this.client.from('records').delete().eq('id', id);
    if (error) throw error;
  }
  async saveSingle(key, value) { await this.upsert(key, key, value); }
}

// ---------------------------------------------------------------------------
// Magasin central
// ---------------------------------------------------------------------------
class Store {
  constructor() {
    this.state = null;
    this.adapter = null;
    this.supabase = null;
    this.listeners = new Set();
  }

  get mode() { return this.adapter ? this.adapter.name : 'local'; }
  get secureAvailable() { return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY); }

  /** Prépare le client Supabase si la configuration existe. */
  async initAuth() {
    if (!this.secureAvailable) return null;
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    this.supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  async signIn(email, password) {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async resetPassword(email) {
    const redirectTo = location.href.split('#')[0];
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async signOut() {
    if (this.supabase) await this.supabase.auth.signOut();
    this.state = null;
  }

  /** Charge les données depuis l'adaptateur choisi. */
  async load(useSecure) {
    this.adapter = useSecure ? new SupabaseAdapter(this.supabase) : new LocalAdapter();
    const raw = await this.adapter.loadAll();
    this.state = {
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
      counters: raw.counters || {},
      meta: raw.meta || { demo: false, seeded: false },
    };
    for (const c of COLLECTIONS) this.state[c] = raw[c] || [];
    return this.state;
  }

  get settings() { return this.state.settings; }
  get isDemo() { return Boolean(this.state.meta.demo); }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }

  all(coll) { return this.state[coll]; }
  get(coll, id) { return this.state[coll].find((x) => x.id === id) || null; }

  async put(coll, item) {
    const now = new Date().toISOString();
    const copy = { ...item };
    if (!copy.id) copy.id = uid();
    if (!copy.createdAt) copy.createdAt = now;
    copy.updatedAt = now;
    const list = this.state[coll];
    const i = list.findIndex((x) => x.id === copy.id);
    if (i >= 0) list[i] = copy; else list.push(copy);
    await this.adapter.saveItem(coll, copy, list);
    this.emit();
    return copy;
  }

  async remove(coll, id) {
    this.state[coll] = this.state[coll].filter((x) => x.id !== id);
    await this.adapter.removeItem(coll, id, this.state[coll]);
    this.emit();
  }

  async saveSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    await this.adapter.saveSingle('settings', this.state.settings);
    this.emit();
  }

  async saveMeta(patch) {
    this.state.meta = { ...this.state.meta, ...patch };
    await this.adapter.saveSingle('meta', this.state.meta);
  }

  /**
   * Attribue le numéro suivant, continu et sans trou, par type et par année.
   * series : 'invoice' (factures, acomptes, soldes), 'credit' (avoirs), 'quote' (devis).
   */
  async nextNumber(series, year) {
    const s = this.state.settings;
    const prefix = { invoice: s.invoicePrefix, credit: s.creditPrefix, quote: s.quotePrefix }[series] || 'DOC';
    const counters = this.state.counters;
    counters[series] = counters[series] || {};
    const n = (counters[series][year] || 0) + 1;
    counters[series][year] = n;
    await this.adapter.saveSingle('counters', counters);
    return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
  }

  /** Remplace toutes les données (chargement de la démo ou remise à zéro). */
  async replaceAll(data) {
    for (const c of COLLECTIONS) {
      if (this.adapter.name === 'supabase') {
        for (const old of this.state[c]) await this.adapter.removeItem(c, old.id);
      }
      this.state[c] = deepClone(data[c] || []);
      await this.adapter.saveCollection(c, this.state[c]);
    }
    this.state.counters = deepClone(data.counters || {});
    await this.adapter.saveSingle('counters', this.state.counters);
    if (data.settings) {
      this.state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      await this.adapter.saveSingle('settings', this.state.settings);
    }
    await this.saveMeta(data.meta || {});
    this.emit();
  }

  /** Vrai dès qu'une facture ou un avoir réel a été finalisé (hors démo). */
  hasRealFinalized() {
    return !this.isDemo && this.state.documents.some((d) => d.number && d.kind !== 'quote');
  }

  exportJSON() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), ...this.state }, null, 2);
  }
}

export const store = new Store();
