# SuiviBudget

> Application web moderne de gestion de budget personnel **100% locale, autonome et souveraine** (Zero-Cloud, sans agrégation bancaire intrusive). Moteur de report mensuel intelligent (*RolloverEngine*), gestion des dépenses "en attente" hors total, assistant de configuration initiale (*Onboarding Wizard*), suivi de la capacité d'épargne avec simulation d'intérêts et sécurité biométrique maximale par **WebAuthn / Passkeys**.

---

## 🌟 Fonctionnalités Clés

### 1. Sécurité Avancée & Souveraineté des Données
- **Authentification Passwordless WebAuthn / Passkeys** (FIDO2) : connexion instantanée et infalsifiable par Windows Hello, Touch ID, Face ID ou clé physique de sécurité.
- **Code de Récupération d'Urgence** : clé maîtresse chiffrée permettant la réinitialisation des accès en cas de perte de dispositif.
- **Sessions Sécurisées** : Tokens JWT en cookies `httpOnly`, `SameSite=Strict`, couplés à des refresh tokens rotatifs stockés en base.
- **100% Local-First** : Vos données financières restent exclusivement sur votre machine dans une base SQLite optimisée en mode WAL (Write-Ahead Logging).

### 2. Moteur Financier & Report Intelligent (RolloverEngine)
- **Synchronisation Idempotente** : Génération automatique des opérations récurrentes à l'ouverture d'un nouveau mois sans doublon.
- **Gestion des Dépenses "En attente"** : Exclusion stricte du solde et calcul d'un reste à vivre sécurisé sans fausser le budget.
- **Propagation Temporelle Granulaire** : Modification d'un montant ou mise en attente d'une dépense avec choix de la portée (*Ce mois uniquement* vs *Ce mois et tous les mois futurs*).
- **Report de Solde M-1** : Option de report automatique ou manuel du reliquat (positif ou négatif) du mois précédent.
- **Plafonds par Catégorie** : Définition d'un budget maximum mensuel par catégorie avec alertes visuelles de dépassement.

### 3. Capacité d'Épargne, Tirelires & Simulation d'Intérêts
- **Indicateur de Capacité d'Épargne en temps réel** : Calcul automatique de votre reste à vivre affectable.
- **Projets d'Épargne Personnalisés** : Tirelires dédiées (Vacances, Fonds d'urgence, Travaux, Apport immobilier, etc.).
- **Taux de Rémunération Net & Simulation d'Intérêts** : Saisie d'un taux d'intérêt annuel net (ex: Livret A 3%) et calcul prévisionnel des intérêts composés jusqu'à la date d'échéance estimée.
- **Versement Rapide** : Allocation directe d'une somme depuis votre reste à vivre vers vos projets d'épargne avec suivi de progression.

### 4. Assistant de Première Connexion (Onboarding Wizard)
- Parcours pas-à-pas modulaire pour configurer votre foyer (adultes, enfants, animaux, mode de logement).
- Saisie guidée des salaires, aides, loyer/prêt immobilier, assurances et abonnements.
- **Forfaits mobiles dynamiques** : Configuration flexible du nombre de forfaits avec libellé et bénéficiaire distincts.

### 5. Import Bancaire & Sauvegardes
- **Import intelligent CSV / OFX** : Réconciliation automatique avec détection d'idempotence et prévention des doublons.
- **Sauvegardes chiffrées automatiques (AES-256-GCM)** : Exportation et restauration instantanée de vos données.

---

## 🛠 Stack Technique

- **Frontend** : React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, TanStack Query.
- **Backend** : Node.js, Express, TypeScript, Zod, `@simplewebauthn/server`.
- **Base de données** : SQLite 3 via `better-sqlite3`, migrations versionnées automatiques.

---

## 🚀 Démarrage Rapide

Consultez le guide détaillé [SETUP.md](file:///c:/Gemini/Suivi_Budget/SETUP.md) pour les instructions complètes d'installation.

```bash
# 1. Cloner le projet
git clone https://github.com/bwr62/SuiviBudget.git
cd SuiviBudget

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp server/.env.example server/.env

# 4. Initialiser la base de données
npm run seed

# 5. Lancer l'application
npm run dev
```

Accédez ensuite à l'application sur **http://localhost:5173**.
