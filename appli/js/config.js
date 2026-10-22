// Réglages de connexion à la base de données sécurisée (Supabase).
//
// Tant que ces deux valeurs sont vides, l'application fonctionne en MODE DÉMO :
// les données restent uniquement dans ce navigateur, sur cet appareil.
//
// Pour passer en mode sécurisé, suivre GUIDE-SUPABASE.md puis coller ici :
//   - l'adresse du projet (Project URL), ex. https://abcd1234.supabase.co
//   - la clé publique (publishable key, commence par sb_publishable_)
// La clé publique peut être visible : ce sont les règles de sécurité de la base
// (Row Level Security) qui empêchent toute autre personne de lire les données.
// Ne JAMAIS coller ici la clé secrète « service_role ».

export const SUPABASE_URL = 'https://jybaztaovrjcfrwqobew.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Z5ejbiJ7hjQLgl4bD9hfPQ_IoCG7yIJ';

// Déconnexion automatique après 15 minutes sans activité (mode sécurisé).
export const INACTIVITY_MINUTES = 15;
