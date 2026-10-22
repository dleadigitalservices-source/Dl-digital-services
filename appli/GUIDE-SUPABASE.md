# Guide : protéger mes données avec Supabase

Temps : environ 10 minutes. Gratuit. À faire sur ordinateur, c'est plus confortable.

À la fin, tes données seront dans une base sécurisée en Europe, protégées par ton mot de passe, et tu les retrouveras sur ton iPhone comme sur ton ordinateur.

## Étape 1 · Créer le compte

1. Va sur **supabase.com** et clique sur **Start your project**.
2. Inscris-toi avec ton e-mail pro (dlea.digitalservices@gmail.com).
3. Confirme ton adresse dans l'e-mail reçu.

## Étape 2 · Créer le projet

1. Clique sur **New project**.
2. Nom du projet : `dl-gestion`.
3. Mot de passe de la base : clique sur **Generate a password**, puis garde-le dans ton gestionnaire de mots de passe.
4. Région : choisis **Paris** (ou une autre ville en Europe).
5. Clique sur **Create new project**, puis attends 1 à 2 minutes.

## Étape 3 · Installer la table sécurisée

1. Dans le menu de gauche, ouvre **SQL Editor**.
2. Clique sur **New query**.
3. Colle tout le contenu du fichier `supabase/schema.sql` (Claude peut te le redonner).
4. Clique sur **Run**. Le message « Success » doit s'afficher.

## Étape 4 · Créer ton accès (toi seule)

1. Menu de gauche : **Authentication**, puis **Users**.
2. Clique sur **Add user**, puis **Create new user**.
3. Saisis ton e-mail et un mot de passe solide (au moins 12 caractères).
4. Coche **Auto Confirm User**, puis valide.
5. Va dans **Authentication**, puis **Sign In / Providers** : désactive **Allow new users to sign up**.
   Ainsi, personne d'autre ne pourra créer de compte sur ton application.

## Étape 5 · Donner les 2 informations à Claude

1. Menu de gauche : **Project Settings**, puis **API** (ou **Data API**).
2. Copie la **Project URL** (elle ressemble à `https://xxxx.supabase.co`).
3. Copie la clé **anon public** (ou **publishable**).
4. Envoie ces 2 informations à Claude dans la conversation.

Attention : ne donne **jamais** la clé **service_role** (ou **secret**). Elle doit rester privée.

Claude les ajoute dans l'application, et la publie. Ensuite :

- tu te connectes avec ton e-mail et ton mot de passe ;
- tu complètes tes **Réglages** (nom, adresse, SIRET, IBAN) ;
- tu peux commencer tes vraies factures.

## Bon à savoir

- La clé « anon public » peut être visible dans le code : ce sont les règles de sécurité de la table qui protègent tes données.
- Une facture finalisée ne peut ni être modifiée ni supprimée, même dans la base : c'est la loi (conservation 10 ans).
- Pense à faire une sauvegarde chaque mois : **Réglages › Exporter toutes mes données**. L'application te le rappelle.
- Sur l'offre gratuite, un projet inutilisé pendant une semaine peut être mis en pause : il suffit de le relancer depuis supabase.com.
