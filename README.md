# 🏡 Papounet 🥰 - Les Petits Loulous

Application web mobile (PWA) de visualisation du planning de garde partagée et des repos chez Papounet.

**100% hébergé et propulsé par Cloudflare** (aucune dépendance à Google Apps Script).

---

## ⚡ Architecture Cloudflare Native

- **Frontend** : Hébergé sur **Cloudflare Pages** (HTML5, CSS3, JS moderne, Service Worker PWA).
- **Backend Edge** : **Cloudflare Pages Functions** (`/functions/api/planning.js`) qui s'exécute directement sur le réseau mondial Cloudflare Workers.
- **Zéro Google Apps Script** : Tout le calcul (cycles de 15 semaines, jours de repos théoriques, vacances scolaires, alertes et dates limites de confirmation à S-14 jours) est géré sur Cloudflare.
- **Flux calendriers** : La fonction Cloudflare récupère et décode les flux iCal (`.ics`) directement à la volée.
- **Double moteur de secours** : Même en cas de coupure réseau complète ou en mode avion, le moteur embarqué (`js/engine.js`) et le cache local affichent le planning instantanément (0 ms de temps de chargement).

---

## 📱 Fonctionnalités & Design

- **Design iOS épuré** : cartes arrondies, typographie Roboto & Roboto Condensed, badges thématiques et animations douces.
- **Badges selon le type d'événement** :
  - 🩵 **Garde enfants** (bleu cyan) : heures d'arrivée et de retour.
  - 🚸 **Rendez-vous / Opérations** (jaune doré avec panneau de danger écoliers).
  - 💜 **Vacances scolaires** (violet) : Toussaint, Noël, etc.
  - 🩶 **Repos théorique** (gris) : mention "À confirmer à S -14 jours".
  - 🚨 **Bannière d'alerte** dynamique pour les semaines avec changement potentiel.
- **Navigation rapide** :
  - Bouton avec date du jour en haut à droite (ex: `3 nov`) pour défiler instantanément sur la semaine en cours.
  - Sélecteur de date en bas avec bouton **Go** pour sauter directement sur n'importe quelle semaine dans l'horizon calculé (8 mois).

---

## 📂 Structure du Projet

```text
Papounet/
├── functions/
│   └── api/
│       └── planning.js      # Backend Edge Cloudflare Pages Function (/api/planning)
├── css/
│   └── style.css            # Feuilles de style (design fidèle aux maquettes)
├── js/
│   ├── config.js            # Configuration de l'application
│   ├── engine.js            # Moteur de calcul calendrier client & offline
│   ├── api.js               # Gestionnaire API Cloudflare & Cache local
│   └── app.js               # Rendu dynamique, recherche et défilement
├── index.html               # Page principale (HTML5 sémantique, PWA)
├── manifest.webmanifest     # Manifeste PWA pour installation smartphone
├── sw.js                    # Service Worker (mode hors-ligne & cache Edge)
├── _headers                 # En-têtes Cloudflare Pages (sécurité & cache)
├── icon.svg                 # Icône vectorielle moderne
└── icon.png, icon-192, 512  # Icônes de l'application
```

---

## 🚀 Déploiement & Synchronisation Cloudflare

Le projet est configuré pour se déployer automatiquement à chaque `git push`.

### 1. Pousser les modifications sur GitHub

```bash
git add .
git commit -m "feat: migration complète vers Cloudflare Pages & Functions (adieu Google Apps Script)"
git push origin main
```

Cloudflare Pages détecte automatiquement le commit sur GitHub et déploie le site ainsi que la fonction `/api/planning` en quelques secondes.

---

### 2. Configuration des flux de calendriers dans Cloudflare (Optionnel)

Si vous souhaitez connecter vos calendriers Google sans passer par Apps Script :

1. Dans Google Calendar, récupérez l'**Adresse secrète au format iCal** (ou publique) de vos calendriers.
2. Dans le tableau de bord [Cloudflare](https://dash.cloudflare.com/) > **Workers & Pages** > votre projet **Papounet** > **Settings** > **Environment variables**.
3. Ajoutez les variables (facultatif) :
   - `CALENDAR_ICAL_URL` : URL de votre calendrier de garde.
   - `CALENDAR_RDV_ICAL_URL` : URL de votre calendrier des rendez-vous.

Si ces variables ne sont pas renseignées, la fonction Cloudflare utilise les identifiants par défaut et effectue tous les calculs automatiquement.

---

### 3. Installation sur Smartphone (PWA)

- **Sur iPhone (Safari)** : appuyez sur le bouton Partager ⬆️ > **Sur l'écran d'accueil**.
- **Sur Android (Chrome)** : appuyez sur les 3 points > **Ajouter à l'écran d'accueil**.
