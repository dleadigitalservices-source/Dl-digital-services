// Écran de connexion (mode sécurisé Supabase).

import { store } from '../store.js';
import { esc } from '../util.js';
import { icon, champ, formData, toast } from '../ui.js';

export function render(el, onSuccess) {
  el.innerHTML = `<div class="pile-l">
    <div class="connexion-haut"><div class="connexion-logo"><img src="icons/logo.png" alt="DL Digital Services"></div></div>
    <div style="height:70px"></div>
    <div style="text-align:center" class="pile"><h1 class="accent" style="font-size:28px">Bon retour</h1>
      <p class="sous-titre" style="margin:0">Entrez dans les coulisses de votre activité.</p></div>
    <form class="pile" novalidate>
      ${champ({ label: 'Adresse e-mail', name: 'email', type: 'email', attrs: 'autocomplete="username" autocapitalize="off" inputmode="email" required' })}
      ${champ({ label: 'Mot de passe', name: 'password', type: 'password', attrs: 'autocomplete="current-password" required' })}
      <p class="erreur-form liste-erreurs" hidden role="alert"></p>
      <button type="submit" class="btn plein">Se connecter</button>
      <button type="button" class="lien-btn" data-forgot>Mot de passe oublié ?</button>
    </form>
    <p class="ligne tres-petit doux" style="justify-content:center">${icon('lock', 16)} Données protégées · serveurs en Europe</p>
  </div>`;

  const form = el.querySelector('form');
  const err = form.querySelector('.erreur-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { email, password } = formData(form);
    if (!email || !password) { err.hidden = false; err.textContent = 'Saisissez votre e-mail et votre mot de passe.'; return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Connexion…';
    try {
      await store.signIn(email, password);
      await onSuccess();
    } catch (ex) {
      err.hidden = false;
      err.textContent = /invalid/i.test(ex.message) ? 'E-mail ou mot de passe incorrect.' : `Connexion impossible : ${ex.message}`;
      btn.disabled = false; btn.textContent = 'Se connecter';
    }
  });
  form.querySelector('[data-forgot]').addEventListener('click', async () => {
    const email = form.querySelector('[name=email]').value.trim();
    if (!email) { err.hidden = false; err.textContent = 'Saisissez d’abord votre e-mail, puis touchez « Mot de passe oublié ? ».'; return; }
    try { await store.resetPassword(email); toast('Un e-mail de réinitialisation vous a été envoyé.'); }
    catch (ex) { err.hidden = false; err.textContent = `Envoi impossible : ${ex.message}`; }
  });
}
