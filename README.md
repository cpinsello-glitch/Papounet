# 🏡 Papounet 🥰 - Les Petits Loulous

Application web mobile (PWA) de visualisation du planning de garde partagée et des repos chez Papounet.

---

## 📱 Aperçu & Fonctionnalités

- **Design iOS épuré** : cartes arrondies, typographie Roboto & Roboto Condensed, badges thématiques et animations douces.
- **Affichage par semaine** :
  - 🩵 **Garde enfants** (bleu cyan) : heures d'arrivée et de retour.
  - 🚸 **Rendez-vous / Opérations** (jaune doré avec icône de vigilance).
  - 💜 **Vacances scolaires** (violet) : Toussaint, Noël, etc.
  - 🩶 **Repos théorique** (gris) : avec mention de confirmation à S-14 jours.
  - 🚨 **Bannière d'alerte** dynamique pour les semaines avec changement potentiel.
- **Navigation rapide** :
  - Bouton avec date du jour en haut à droite (ex: `3 nov`) pour défiler instantanément sur la semaine actuelle.
  - Sélecteur de date en bas avec bouton **Go** pour sauter directement sur n'importe quelle semaine dans l'horizon calculé.
- **Fonctionnement hors-ligne & vitesse éclair** :
  - Cache local instantané (`localStorage`) : la page s'ouvre sans aucun délai d'attente.
  - Rafraîchissement automatique en arrière-plan depuis l'API Google Apps Script avec indicateur discret.
  - Service Worker et PWA pour l'installation sur l'écran d'accueil (iPhone et Android).

---

## 📂 Structure du Projet

```text
Papounet/
├── index.html               # Page principale (HTML5 sémantique, PWA ready)
├── manifest.webmanifest     # Manifeste PWA pour installation mobile
├── sw.js                    # Service Worker (gestion du cache et offline)
├── _headers                 # Configuration du cache pour Cloudflare Pages
├── icon.svg                 # Icône vectorielle haute résolution
├── icon.png                 # Icône PWA 256x256
├── icon-192.png             # Icône PWA 192x192
├── icon-512.png             # Icône PWA 512x512
├── css/
│   └── style.css            # Feuilles de style (design fidèle aux maquettes)
├── js/
│   ├── config.js            # Configuration générale & URL de l'API
│   ├── api.js               # Gestion du cache et des appels API
│   └── app.js               # Logique d'affichage, recherche et défilement
└── backend/
    └── code.gs              # Code source du backend Google Apps Script
```

---

## 🚀 Déploiement : GitHub & Cloudflare Pages

### 1. Créer le dépôt sur GitHub et pousser le code

Dans un terminal à la racine du projet :

```bash
# Vérifier l'état
git status

# Ajouter tous les fichiers et faire le premier commit
git add .
git commit -m "feat: initialisation du projet Papounet moderne"

# Créer votre dépôt sur github.com (ex: nom "Papounet")
# Puis liez votre dépôt distant et poussez :
git remote add origin https://github.com/cpinsello-glitch/Papounet.git
git branch -M main
git push -u origin main
```

---

### 2. Déployer sur Cloudflare Pages

1. Rendez-vous sur votre tableau de bord [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages**.
2. Cliquez sur **Create application** > onglet **Pages** > **Connect to Git**.
3. Sélectionnez votre dépôt GitHub **`Papounet`**.
4. Configurez les options de build :
   - **Project name** : `papounet` (ou le nom de votre choix)
   - **Production branch** : `main`
   - **Framework preset** : `None`
   - **Build command** : *(laisser vide)*
   - **Build output directory** : `.` *(ou laisser vide / racine)*
5. Cliquez sur **Save and Deploy**.

> ✨ En quelques secondes, votre application est en ligne avec HTTPS automatique, CDN mondial ultra-rapide et mise à jour automatique à chaque `git push` !

---

### 3. Backend Google Apps Script (si besoin de modification)

Le code dans `backend/code.gs` est déployé en tant qu'**Application Web Google Apps Script** :
- **Exécuter en tant que** : *Moi*
- **Qui a accès** : *Tout le monde (Anyone)*

L'URL de production est définie dans `js/config.js` (`API_URL`). Si vous redéployez votre script, mettez simplement à jour cette variable.

---

### 4. Installer sur smartphone (PWA)

- **Sur iPhone (Safari)** : appuyez sur l'icône de partage ⬆️ > **Sur l'écran d'accueil**.
- **Sur Android (Chrome)** : appuyez sur le menu (trois points) > **Ajouter à l'écran d'accueil** ou **Installer l'application**.
