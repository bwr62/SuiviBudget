# Guide d'Installation et de Démarrage (Setup Guide)

Ce guide décrit la procédure pas-à-pas pour installer, configurer et exécuter **SuiviBudget** en local ou en production.

---

## 1. Prérequis Système

- **Node.js** : version **>= 20.0.0** (recommandé Node.js 20 LTS ou 22 LTS)
- **npm** : version **>= 10.0.0** (fourni avec Node.js)
- **Navigateur Web récent** supportant l'authentification **WebAuthn / Passkeys** (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari, Brave)
- **Système d'exploitation** : Windows 10/11, macOS ou Linux

---

## 2. Cloner et Installer les Dépendances

### Cloner le dépôt
```bash
git clone https://github.com/bwr62/SuiviBudget.git
cd SuiviBudget
```

### Installer les dépendances
Le projet utilise les npm workspaces pour gérer le client et le serveur :
```bash
npm install
```
*Cette commande installe automatiquement les dépendances de la racine, du dossier `server/` et du dossier `client/`.*

---

## 3. Configuration des Variables d'Environnement

Un fichier template `.env.example` est fourni dans le dossier `server/`. Créez votre fichier de configuration `server/.env` :

### Sur Windows (PowerShell) :
```powershell
Copy-Item server/.env.example server/.env
```

### Sur Linux / macOS :
```bash
cp server/.env.example server/.env
```

### Détail des variables dans `server/.env` :
```env
# Port d'écoute de l'API backend Express
PORT=3001

# URL d'origine acceptée par le CORS (adresse de votre frontend Vite)
CLIENT_ORIGIN=http://localhost:5173

# WebAuthn / Passkeys : identifiant de Relying Party
# En local : 'localhost'. En production : 'votre-domaine.fr'
RP_ID=localhost
RP_NAME=SuiviBudget

# Origine autorisée pour la validation des signatures WebAuthn
RP_ORIGIN=http://localhost:5173

# Secret aléatoire pour la signature des JSON Web Tokens (session d'authentification)
# IMPORTANT : Générez une clé secrète longue et robuste en production
JWT_SECRET=suivi-budget-super-secret-jwt-key-change-in-production

# Chemin d'accès au fichier de base de données SQLite
DATABASE_PATH=./data/budget.sqlite
```

---

## 4. Initialisation de la Base de Données

Le système de migration intégré applique automatiquement les 7 schémas et initialise le référentiel des catégories (20 catégories et 83 sous-catégories) :

```bash
npm run seed
```

*Note : La base SQLite sera créée dans `server/data/budget.sqlite`. Ce dossier est automatiquement sauvegardé toutes les heures si configuré.*

---

## 5. Démarrage en Mode Développement

Pour lancer simultanément le backend et le frontend avec rechargement à chaud (Hot Reload) :

### Option A : Lancer les deux ensemble depuis la racine
```bash
npm run dev
```

### Option B : Lancer dans deux terminaux séparés
**Terminal 1 (Backend API)** :
```bash
npm run dev:server
# Le serveur démarre sur http://localhost:3001
```

**Terminal 2 (Frontend React/Vite)** :
```bash
npm run dev:client
# L'application est accessible sur http://localhost:5173
```

Ouvrez votre navigateur sur **http://localhost:5173**.

---

## 6. Premier Démarrage & Création de Compte

1. **Création du Compte Maître (Passkey)** :
   - À la première visite, un écran de configuration vous invite à enregistrer votre Passkey (reconnaissance faciale Windows Hello, Touch ID, clé de sécurité FIDO2 ou code PIN).
   - Un **Code de Récupération d'Urgence** (ex: `SB-XXXX-XXXX-...`) est généré. **Notez-le précieusement** : il permet de réinitialiser vos identifiants si vous perdez l'accès à votre Passkey.
2. **Assistant de Première Connexion (Onboarding Wizard)** :
   - Renseignez la composition du foyer (adultes, enfants, animaux, mode de transport).
   - Configurez vos revenus mensuels, votre loyer / prêt immobilier, vos forfaits mobiles (avec libellé et bénéficiaire par ligne).
   - Configurez vos abonnements, courses et assurances.
   - Les dépenses récurrentes générées sont automatiquement propagées avec l'historique et les règles de rollover.

---

## 7. Tests Automatisés & Vérification

Pour exécuter la suite de tests unitaires et d'intégration du moteur de calcul (`RolloverEngine`, synchronisation, propagation) :

```bash
npm test
```

Pour vérifier la compilation TypeScript et les linters :
```bash
npm run build:server
npm run build:client
```

---

## 8. Déploiement en Production

Pour compiler les bundles optimisés de production :

```bash
# 1. Compilation
npm run build

# 2. Démarrage du serveur en mode production
npm run start:server
```

### Recommandations pour la production :
- Placez un reverse proxy (**Nginx**, **Caddy** ou **Traefik**) devant l'application avec un certificat SSL (**HTTPS est obligatoire pour WebAuthn en dehors de localhost**).
- Modifiez `RP_ID` et `RP_ORIGIN` dans `server/.env` pour correspondre à votre nom de domaine réel (ex: `budget.mondomaine.fr`).
- Sauvegardez régulièrement le fichier `server/data/budget.sqlite` ou utilisez la fonction d'exportation de sauvegarde intégrée dans l'interface (Menu Paramètres -> Télécharger sauvegarde chiffrée).
