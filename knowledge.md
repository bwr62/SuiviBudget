# 🧠 KNOWLEDGE BASE - APPLICATION DE GESTION DE BUDGET (PC)

> **AVERTISSEMENT** : Ce fichier est la source de vérité architecturale du projet. Tu DOIS le mettre à jour en temps réel à chaque création ou modification de fichier. Ne supprime jamais l'historique du Changelog.

---

## 1. ÉTAT D'AVANCEMENT DU PROJET
- [x] **Étape 1** : Initialisation Monorepo & Configuration TypeScript (`/server` et `/client`)
- [x] **Étape 2** : Base de données SQLite (`better-sqlite3`) & Seed exhaustif des 20 catégories / 83 sous-catégories
- [x] **Étape 3** : Sécurité maximale (WebAuthn Passkeys + JWT >= 32 chars + Secours Argon2id)
- [x] **Étape 4** : API REST & Moteur de Report Mensuel (`Rollover Engine`) avec ACID et exclusion stricte `PENDING`
- [x] **Étape 5** : Frontend - Layout Desktop (1280px-2560px), Sidebar 7 onglets, Switch rapide & Tableaux dynamiques
- [x] **Étape 6** : Frontend - CRUD Catégories (édition, ajout de sous-catégories) & Statistiques visuelles (`Recharts`)
- [x] **Étape 7** : Assistant d'onboarding complet en 6 étapes & propagation temporelle avec intégrité historique
- [x] **Étape 8** : Audit complet v1 (résolution C1, C2, H1-H5, N1-N8, E1-E6)
- [x] **Étape 9** : Audit v2 100% résolu (Toasts Undo, Tri interactif, Poches d'épargne, Plafonds budgétaires, Import/Export CSV, Sécurité 10Mo & RateLimit 5/h, PWA, Vendor Chunks, Snapshot BDD clôture).

---

## 2. ARCHITECTURE & STACK TECHNIQUE
* **Version du projet** : `v0.07`
* **Architecture** : Monorepo npm avec workspaces (`server`, `client`).
* **Frontend** : React 19, Vite 8, TypeScript strict (`ES2022`, `bundler`), Tailwind CSS (v4 via `@tailwindcss/vite`), Zustand (`useUIStore`, `useToastStore`), TanStack Query v5 (requêtes et mutations réactives avec invalidations ciblées, migration AnalyticsView complète), Recharts, Lucide React, SimpleWebAuthn Browser, PWA (`manifest.json` installable sur Desktop/Mobile, Rollup `manualChunks` vendor splitting).
* **Backend** : Node.js (v26), Express, TypeScript strict (`ES2022`, `NodeNext`), architecture modulaire en 7 sous-routeurs Express (`months`, `transactions`, `categories`, `stats`, `backup`, `onboarding`, `savings`), gestionnaire d'erreurs centralisé `errorHandler`, Zod, SimpleWebAuthn Server, Argon2id, JWT (Access Token 15 min + Refresh Token 7 jours avec rotation et stockage SQLite), Helmet avec CSP durci, CORS verrouillé, Cookie-parser, Express Rate Limit (limiteur général 100/15min + limiteur strict `recoveryLimiter` 5/heure sur le code de secours), `express.json({ limit: '10mb' })` pour les imports massifs, snapshot automatique de la base SQLite à la clôture de mois dans `server/data/backups/`.
* **Base de données** : SQLite locale via `better-sqlite3` (`server/data/budget.sqlite`) en mode `WAL` avec `foreign_keys = ON`, `synchronous = NORMAL`, et système de migrations versionnées (`schema_versions`, migrations 1 à 7 : migration 6 plafonds budgétaires, migration 7 poches d'épargne et allocations).
* **Tests** : Suite de tests automatisée native Node.js (`node:test` + `node:assert/strict` via `tsx --test`) couvrant 9 scénarios (idempotence, calcul de dates, exclusion PENDING, portée temporelle, report M-1, plafonds de catégories, allocations d'épargne).

---

## 3. REGISTRE EXHAUSTIF DES FICHIERS

| Chemin du Fichier | Rôle & Responsabilité | Exports Principaux (Fonctions / Composants) | Dépendances Internes | Statut |
| :--- | :--- | :--- | :--- | :--- |
| `package.json` | Racine du monorepo npm | Scripts `dev:*`, `build:*`, `seed`, `test` | - | Actif |
| `SPECIFICATIONS.md` | Cahier des charges technique et fonctionnel | - | - | Actif |
| `knowledge.md` | Base documentaire vivante du projet | - | - | Actif |
| `audit151026.md` | Rapport d'audit complet v1 (100% résolu) | - | - | Actif |
| `audit151026v2.md` | Rapport d'audit v2 & suggestions d'améliorations (UX, Sécurité, Métier) | - | - | Actif |
| `.gitignore` | Exclusion de node_modules, dist et bases sqlite | - | - | Actif |
| `RolloverService.ts` | Prototype initial de référence | `RolloverEngine`, `MonthlySummary` | - | Archivé |
| `server/package.json` | Dépendances et scripts du backend Node.js | Scripts `dev`, `build`, `seed`, `test` | - | Actif |
| `server/tsconfig.json` | Configuration TypeScript stricte du backend | Options `NodeNext`, `strict: true` | - | Actif |
| `server/.env` | Variables d'environnement locales (secret JWT > 32 chars) | Variables d'environnement | - | Actif |
| `server/src/config/env.ts` | Validateur de configuration et de sécurité JWT | `env` | - | Actif |
| `server/src/middlewares/auth.ts` | Middleware auth JWT avec auto-refresh token (15m / 7j) | `requireAuth`, `issueAuthTokens`, `revokeUserRefreshTokens` | `server/src/config/env.ts`, `server/src/db/index.ts` | Actif |
| `server/src/middlewares/errorHandler.ts` | Gestionnaire d'erreurs centralisé Express (H1) | `errorHandler` | - | Actif |
| `server/src/utils/dbHelpers.ts` | Helpers génériques BDD (buildDynamicUpdate DRY, roundCurrency E5) | `buildDynamicUpdate`, `roundCurrency` | - | Actif |
| `server/src/db/schema.ts` | Schéma DDL SQL et types TypeScript stricts des entités | `DDL_SCHEMA`, interfaces entités | - | Actif |
| `server/src/db/migrator.ts` | Moteur de migrations SQLite versionnées (1 à 5) (C1) | `runMigrations`, `migrations` | `server/src/db/schema.ts` | Actif |
| `server/src/db/index.ts` | Instance SQLite `better-sqlite3` (WAL, FK ON) & migrations auto | `db`, `initDatabase` | `server/src/db/migrator.ts` | Actif |
| `server/src/db/seed.ts` | Script d'amorçage des 20 catégories et 83 sous-catégories | `SEED_CATEGORIES`, `seedCategories` | `server/src/db/index.ts` | Actif |
| `server/src/services/rolloverService.ts` | Moteur de report mensuel ACID, calculs PENDING, portée temporelle | `RolloverEngine`, `rolloverService`, `MonthlySummary` | `server/src/db/index.ts` | Actif |
| `server/src/tests/rollover.test.ts` | Suite de tests automatisés native Node.js (E2) | 7 tests (Idempotence, PENDING, Scope, M-1) | `server/src/services/rolloverService.ts` | Actif |
| `server/src/routes/auth.ts` | Routes WebAuthn FIDO2 / Passkeys, Refresh Tokens, secours Argon2id | `authRouter` | `server/src/db/index.ts`, `server/src/config/env.ts` | Actif |
| `server/src/routes/months.ts` | Routes gestion des mois, clôture N4, courbe journalière N5 | `monthsRouter` | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `server/src/routes/transactions.ts` | Routes CRUD transactions et récurrences avec portée temporelle | `transactionsRouter` | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `server/src/routes/categories.ts` | Routes CRUD catégories et sous-catégories | `categoriesRouter` | `server/src/db/index.ts` | Actif |
| `server/src/routes/stats.ts` | Routes statistiques annuelles, répartition et Top 5 N6 | `statsRouter` | `server/src/db/index.ts` | Actif |
| `server/src/routes/backup.ts` | Routes exports JSON/DB et import atomique JSON C2 | `backupRouter`, `autoBackupOnClose` | `server/src/db/index.ts` | Actif |
| `server/src/routes/onboarding.ts` | Routes profil foyer et finalisation wizard onboarding | `onboardingRouter` | `server/src/db/index.ts` | Actif |
| `server/src/routes/savings.ts` | Routes CRUD objectifs et allocations de tirelires (F2) | `savingsRouter` | `server/src/db/index.ts` | Actif |
| `server/src/routes/api.ts` | Routeur racine montant les 7 sous-routeurs thématiques (H1, F2) | `apiRouter` | 7 sous-routeurs + `errorHandler` | Actif |
| `client/public/manifest.json` | Web App Manifest pour installation PWA Desktop/Mobile (P1) | Manifest PWA | - | Actif |
| `client/src/store/useToastStore.ts` | Store Zustand de notifications Toast légères avec Undo 5s (U1) | `useToastStore`, `showToast` | - | Actif |
| `client/src/components/ui/Toast.tsx` | Conteneur d'affichage des Toasts réactifs avec bouton Annuler (U1) | `ToastContainer` | `useToastStore` | Actif |
| `client/src/components/SavingsView.tsx` | Vue dédiée aux projets et poches d'épargne avec tirelires (F2) | `SavingsView` | `savingsGoals`, `savingsAllocations` | Actif |
| `client/src/components/BankImportModal.tsx` | Assistant modal d'import relevé bancaire CSV avec auto-catégorisation (F3) | `BankImportModal` | `categories` | Actif |
| `server/src/index.ts` | Serveur Express, Helmet, CORS, Rate-limiting | Point d'entrée serveur Express | Routes auth & API | Actif |
| `client/package.json` | Dépendances et scripts du frontend React/Vite | Scripts `dev`, `build`, `lint` | - | Actif |
| `client/tsconfig.app.json` | Configuration stricte TypeScript de l'application client | Options TypeScript `strict: true` | - | Actif |
| `client/vite.config.ts` | Configuration Vite avec Tailwind CSS et proxy API 3001 | Configuration Vite | - | Actif |
| `client/index.html` | Point d'entrée HTML avec script bloquant anti-FOUC (E6) | Script synchrone thème | - | Actif |
| `client/src/index.css` | Styles Tailwind CSS, variables CSS & thème clair pastel bleu/vert | Directive `@import "tailwindcss";` | - | Actif |
| `client/src/types/index.ts` | Interfaces et types TypeScript partagés côté client | Types entités financières | - | Actif |
| `client/src/store/useUIStore.ts` | Store Zustand pour navigation d'onglets, mois et thème | `useUIStore`, type `TabType` | - | Actif |
| `client/src/components/Sidebar.tsx` | Barre de navigation latérale 7 onglets (260px) + thème switcher | `Sidebar` | `client/src/store/useUIStore.ts` | Actif |
| `client/src/components/MonthHeader.tsx` | En-tête mois, clôture de mois (N4) et toggle report M-1 | `MonthHeader` | `client/src/store/useUIStore.ts` | Actif |
| `client/src/components/DashboardView.tsx` | Tableau de bord : KPIs, jauge, Top 5 (N6) et Capacité d'épargne | `DashboardView` | `client/src/types/index.ts` | Actif |
| `client/src/components/TransactionsTableView.tsx` | Orchestrateur tableau transactions (recherche, raccourci 'N') | `TransactionsTableView` | `transactions/*`, `ToggleScopeModal` | Actif |
| `client/src/components/transactions/SearchBar.tsx` | Composant barre de recherche filtrant instantanément (N1) | `SearchBar` | - | Actif |
| `client/src/components/transactions/AddTransactionForm.tsx` | Formulaire d'ajout rapide dépliable avec auto-focus (N1) | `AddTransactionForm` | - | Actif |
| `client/src/components/transactions/TransactionRow.tsx` | Ligne de transaction avec badges, toggle statut et suppression (N1) | `TransactionRow` | - | Actif |
| `client/src/components/CategoriesView.tsx` | Vue catégories avec import/export JSON (C2) et cartes modulaires | `CategoriesView` | `categories/*` | Actif |
| `client/src/components/categories/CategoryCard.tsx` | Carte individuelle de catégorie avec édition et sous-catégories (N2) | `CategoryCard` | `SubcategoryEditor` | Actif |
| `client/src/components/categories/SubcategoryEditor.tsx` | Éditeur inline pour ajout/renommage/suppression de sous-catégories (N2) | `SubcategoryEditor` | - | Actif |
| `client/src/components/categories/NewCategoryModal.tsx` | Modale accessible d'ajout de nouvelle catégorie avec palette (N2) | `NewCategoryModal` | - | Actif |
| `client/src/components/UpdateScopeModal.tsx` | Modale accessible de choix de portée lors de l'édition d'une récurrence | `UpdateScopeModal` | - | Actif |
| `client/src/components/ToggleScopeModal.tsx` | Modale accessible de choix de mise en attente (Mois seul vs Futurs) | `ToggleScopeModal` | - | Actif |
| `client/src/components/OnboardingWizard.tsx` | Assistant d'onboarding découpé et orchestrateur modulaire | `OnboardingWizard` | `client/src/components/onboarding/*` | Actif |
| `client/src/components/onboarding/types.ts` | Types TypeScript stricts des étapes de l'onboarding | `TemplateDraft`, `StepProps` | `client/src/types` | Actif |
| `client/src/components/onboarding/Step1Household.tsx` | Étape 1 : Composition du foyer (adultes, enfants, animaux, paie) | `Step1Household` | `client/src/components/onboarding/types.ts` | Actif |
| `client/src/components/onboarding/Step2Income.tsx` | Étape 2 : Rentrées d'argent dynamiques et aides sociales | `Step2Income` | `client/src/components/onboarding/types.ts` | Actif |
| `client/src/components/onboarding/Step3Housing.tsx` | Étape 3 : Logement, loyer, prêts immo avec date de fin | `Step3Housing` | `client/src/components/onboarding/types.ts` | Actif |
| `client/src/components/onboarding/Step4Loans.tsx` | Étape 4 : Autres crédits & extinction automatique | `Step4Loans` | `client/src/components/onboarding/types.ts` | Actif |
| `client/src/components/onboarding/Step5RecurringExpenses.tsx` | Étape 5 : Charges fixes & forfaits mobiles personnalisables | `Step5RecurringExpenses` | `client/src/components/onboarding/types.ts` | Actif |
| `client/src/components/onboarding/Step6Summary.tsx` | Étape 6 : Synthèse financière en direct et validation | `Step6Summary` | `client/src/components/onboarding/types.ts` | Actif |
| `client/src/components/AnalyticsView.tsx` | Graphiques Recharts : Courbe trésorerie AreaChart (N5), répartition | `AnalyticsView` | `client/src/types/index.ts` | Actif |
| `client/src/components/AuthModal.tsx` | Modal WebAuthn Passkeys et déverrouillage de secours | `AuthModal` | `@simplewebauthn/browser` | Actif |
| `client/src/App.tsx` | Composant racine migré vers TanStack Query v5 (useQuery/useMutation) | `App` | Tous les composants client | Actif |
| `client/src/main.tsx` | Point d'entrée React avec QueryClientProvider configuré | Root render | `client/src/App.tsx` | Actif |

---

## 4. SCHÉMA SQLite & INDEX ACTIFS

* **Tables actives** :
  * `schema_versions` : Suivi des migrations de schéma versionnées (1 à 5).
  * `users` : Comptes utilisateurs (`id`, `username`, `recovery_hash`, `created_at`).
  * `passkeys` : Clés publiques WebAuthn (`credential_id`, `user_id`, `public_key`, `counter`, `transports`).
  * `auth_challenges` : Stockage SQLite temporaire des challenges FIDO2 avec TTL de 5 minutes.
  * `refresh_tokens` : Tokens de rafraîchissement chiffrés avec expiration et révocation (E3).
  * `household_profile` : Profil singleton (`id = 1`) composition du foyer et jour de paie.
  * `categories` : Catégories système et personnalisées (`user_id`, `id`, `name`, `type`, `icon`, `color`, `is_system`, `is_active`).
  * `subcategories` : Sous-catégories avec cascade FK.
  * `recurring_templates` : Modèles d'opérations récurrentes (`user_id`, `carry_over`, `day_of_month`, `status`, `end_month_year`).
  * `transactions` : Instances réelles mensuelles (`user_id`, `status` ACTIVE / PENDING, `is_carried_over`, `month_year`).
  * `monthly_balances` : Reliquat et clôtures mensuelles (`user_id`, `carried_over_from_previous`, `is_closed`).
* **Index de performance & intégrité** :
  * `idx_transactions_template_id` : Index sur `transactions(template_id)` (H3).
  * `idx_unique_template_per_month` : UNIQUE sur `transactions(template_id, month_year)` WHERE `template_id IS NOT NULL`.
  * `idx_transactions_month_status` : Index sur `transactions(month_year, status)`.
  * `idx_transactions_date` : Index sur `transactions(date)`.
  * `idx_subcategories_category_id` : Index sur `subcategories(category_id)`.
  * `idx_transactions_user_id`, `idx_recurring_templates_user_id`, `idx_categories_user_id` : Index multi-profils (E4).

---

## 5. LOGIQUE MÉTIER CRITIQUE & ALGORITHMES
### 5.1 Règle d'exclusion des dépenses "En attente" (`PENDING`) & Toggle Scope
* **Fichier responsable** : `server/src/services/rolloverService.ts` & `client/src/components/ToggleScopeModal.tsx`.
* Toutes les agrégations financières filtrent avec `WHERE status = 'ACTIVE'`.
* Le reste à vivre réel (`netBalance = carriedOver + income - activeExpenses`) ne déduit jamais les dépenses `PENDING`.
* Lors de la mise en attente d'une dépense répétée, le dialogue `ToggleScopeModal` propose de suspendre également les récurrences futures (`stopFutureRepetitions = true`), basculant le modèle parent en `PENDING_PAUSED`.

### 5.2 Capacité d'épargne & Taux d'épargne
* **Calcul temps réel** : Si le reste à vivre net est supérieur à 0, la capacité d'épargne est égale au solde net.
* Le **taux d'épargne** est affiché en pourcentage : `((Revenus Totaux - Dépenses Actives) / Revenus Totaux) * 100`.

### 5.3 Moteur de Report Mensuel (`Rollover Engine`) & Clôture de Mois
* Clôture formelle (`is_closed = 1`) d'un mois via `PATCH /api/months/:monthYear/close` empêchant ou signalant toute modification accidentelle.
* Évolution quotidienne de la trésorerie calculée par `/api/months/:monthYear/daily-curve` pour affichage graphique.

---

## 6. CONTRATS D'API (ENDPOINTS REST)

| Méthode | Endpoint | Authentifié | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Non | Statut du serveur et version dynamique (0.06) |
| `GET` | `/api/auth/status` | Non | Statut initial compte configuré |
| `POST` | `/api/auth/register/start` | Non | Options WebAuthn enregistrement |
| `POST` | `/api/auth/register/finish` | Non | Vérification WebAuthn, Access Token + Refresh Token |
| `POST` | `/api/auth/login/start` | Non | Options WebAuthn login |
| `POST` | `/api/auth/login/finish` | Non | Vérification WebAuthn, émission tokens sécurisés |
| `POST` | `/api/auth/login/recovery` | Non | Secours par code maître Argon2id |
| `POST` | `/api/auth/logout` | Oui | Révocation en BDD du Refresh Token et effacement des cookies |
| `GET` | `/api/auth/me` | Oui | Profil session active |
| `GET` | `/api/months/:monthYear` | Oui | Initialisation / Rollover du mois et agrégats financiers |
| `PATCH`| `/api/months/:monthYear/close` | Oui | **NOUVEAU** (N4) : Clôture formelle du mois |
| `PATCH`| `/api/months/:monthYear/reopen`| Oui | **NOUVEAU** (N4) : Réouverture d'un mois clôturé |
| `GET` | `/api/months/:monthYear/daily-curve` | Oui | **NOUVEAU** (N5) : Courbe journalière de trésorerie pour AreaChart |
| `POST` | `/api/transactions` | Oui | Création de transaction (dérivation date -> mois & option récurrence) |
| `PATCH` | `/api/transactions/:id` | Oui | Modification de transaction avec portée temporelle (scope) |
| `PATCH` | `/api/transactions/:id/status`| Oui | Bascule `ACTIVE` vs `PENDING` avec option `stopFutureRepetitions` |
| `DELETE`| `/api/transactions/:id` | Oui | Suppression transaction |
| `GET` | `/api/recurring-templates` | Oui | Liste des modèles récurrents |
| `POST` | `/api/recurring-templates` | Oui | Création d'un modèle récurrent |
| `PATCH` | `/api/recurring-templates/:id`| Oui | Modification d'un modèle récurrent |
| `DELETE`| `/api/recurring-templates/:id` | Oui | Suppression modèle |
| `GET` | `/api/categories` | Oui | Liste complète catégories + sous-catégories |
| `POST` | `/api/categories` | Oui | Création d'une catégorie |
| `PATCH` | `/api/categories/:id` | Oui | Modification du nom/couleur d'une catégorie existante |
| `DELETE`| `/api/categories/:id` | Oui | Suppression d'une catégorie personnalisée |
| `POST` | `/api/categories/:id/subcategories` | Oui | Ajout d'une sous-catégorie |
| `PATCH` | `/api/subcategories/:id` | Oui | Renommage d'une sous-catégorie |
| `DELETE`| `/api/subcategories/:id` | Oui | Suppression sécurisée d'une sous-catégorie |
| `GET` | `/api/stats/annual` | Oui | Statistiques annuelles (hors PENDING) |
| `GET` | `/api/stats/category-distribution`| Oui| Répartition par catégorie |
| `GET` | `/api/stats/top-categories` | Oui | **NOUVEAU** (N6) : Top 5 des catégories de dépenses |
| `GET` | `/api/backup/export/json` | Oui | Export complet JSON avec horodatage et version dynamique |
| `POST` | `/api/backup/import/json` | Oui | **NOUVEAU** (C2) : Restauration intégrale d'une sauvegarde JSON |
| `GET` | `/api/backup/export/db` | Oui | Téléchargement du fichier SQLite brut |
| `GET` | `/api/onboarding/status` | Oui | Profil du foyer et avancement onboarding |
| `POST` | `/api/onboarding/complete` | Oui | Finalisation atomique de l'onboarding |
| `GET` | `/api/savings/goals` | Oui | **NOUVEAU** (F2) : Liste des projets et tirelires d'épargne |
| `POST` | `/api/savings/goals` | Oui | **NOUVEAU** (F2) : Création d'une tirelire/objectif d'épargne |
| `PATCH`| `/api/savings/goals/:id` | Oui | **NOUVEAU** (F2) : Modification d'un projet d'épargne |
| `DELETE`| `/api/savings/goals/:id` | Oui | **NOUVEAU** (F2) : Suppression d'un projet d'épargne |
| `POST` | `/api/savings/allocate` | Oui | **NOUVEAU** (F2) : Allocation d'épargne vers un objectif |
| `GET` | `/api/savings/allocations/:monthYear` | Oui | **NOUVEAU** (F2) : Historique des allocations du mois |
| `GET` | `/api/transactions/search` | Oui | **NOUVEAU** (F5) : Recherche transverse multi-mois par libellé/catégorie |
| `PATCH`| `/api/transactions/batch/status` | Oui | **NOUVEAU** (U4) : Mise en attente ou activation par lot |
| `POST` | `/api/transactions/batch/delete` | Oui | **NOUVEAU** (U4) : Suppression groupée par lot |
| `GET` | `/api/transactions/export/csv` | Oui | **NOUVEAU** (F4) : Export CSV encodé UTF-8 BOM |

---

## 7. JOURNAL DES MODIFICATIONS (CHANGELOG D'AUDIT)

### [Version 0.07] - 2026-10-15
* **Résolution Intégrale de l'Audit v2 (audit151026v2.md - 100% Couvert)** :
  * **U1 - Système de Toasts avec Annulation (Undo 5s)** :
    * Création de `client/src/store/useToastStore.ts` et `client/src/components/ui/Toast.tsx`.
    * Notifications animées en bas à droite avec bouton interactif `[Annuler]` lors des modifications de statut et actions importantes.
  * **U2 - Tri Interactif et Filtres Avancés par Colonne** :
    * Dans `TransactionsTableView.tsx`, en-têtes cliquables avec flèches indicatrices : tri par Date, Libellé, Catégorie, Statut et Montant (ascendant/descendant).
    * Filtre déroulant dynamique par sous-catégorie intégré dans `SearchBar.tsx`.
  * **U3 - Raccourcis Clavier Power User** :
    * `Alt + Flèche Gauche` / `Alt + Flèche Droite` : Navigation immédiate d'un mois à l'autre.
    * `/` ou `Ctrl + F` : Focus automatique instantané sur la barre de recherche.
  * **U4 - Sélection Multiple & Actions Groupées (Batch Actions)** :
    * Case à cocher par ligne et *"Tout sélectionner"* dans l'en-tête du tableau.
    * Barre d'actions contextuelle permettant de mettre en attente, réactiver ou supprimer un lot de transactions sélectionnées d'un seul clic (`PATCH /api/transactions/batch/status` et `POST /api/transactions/batch/delete`).
  * **F1 - Plafonds Budgétaires par Catégorie (Enveloppes)** :
    * Migration SQLite v6 : ajout de la colonne `budget_limit` sur `categories`.
    * Saisie du plafond mensuel indicatif dans `CategoryCard.tsx` et `NewCategoryModal.tsx`.
    * Widget de suivi dans `DashboardView.tsx` avec jauges vertes (<75%), oranges (75-99%) et rouges clignotantes (>100% avec calcul de dépassement).
  * **F2 - Poches d'Épargne & Projets Financiers (Tirelires)** :
    * Migration SQLite v7 : tables `savings_goals` et `savings_allocations`.
    * Nouvel onglet de navigation *"Projets & Épargne"* et vue dédiée `SavingsView.tsx`.
    * Suivi des objectifs (fonds de précaution, vacances, apport) et versement direct depuis la capacité d'épargne du mois.
  * **F3 - Import Bancaire Universel (Fichiers CSV)** :
    * Composant modal `BankImportModal.tsx` avec parseur CSV multi-séparateurs (BoursoBank, CA, BNP, Revolut...).
    * Auto-catégorisation intelligente par mots-clés et détection des rentrées/dépenses avec prévisualisation avant validation.
  * **F4 - Export CSV Mensuel et Annuel** :
    * Bouton d'export CSV intégré dans l'en-tête de mois `MonthHeader.tsx` appelant `GET /api/transactions/export/csv` avec encodage UTF-8 BOM.
  * **F5 - Recherche Transverse Multi-Mois** :
    * Endpoint backend `GET /api/transactions/search` autorisant les requêtes multicritères sur l'ensemble de l'historique financier.
  * **S1 - Rate Limiting Renforcé sur le Code de Secours** :
    * Application d'un middleware dédié `recoveryLimiter` sur `/api/auth/login/recovery` limitant les tentatives à **5 essais par heure**.
  * **S2 - Augmentation du Payload JSON Maximal à 10 Mo** :
    * Configuration explicite `express.json({ limit: '10mb' })` dans `server/src/index.ts`.
  * **S3 - Sauvegarde SQLite Automatique lors de la Clôture** :
    * Fonction `autoBackupOnClose` déclenchée sur `PATCH /api/months/:monthYear/close` générant un snapshot consolidé dans `server/data/backups/budget_auto_YYYY-MM.sqlite` (conservation glissante des 12 derniers mois).
  * **S4 - Durcissement des En-têtes Content Security Policy (CSP)** :
    * Configuration Helmet avec directives strictes autorisant les origines locales et protégeant contre les injections XSS.
  * **P1 - Progressive Web App (PWA) Installable** :
    * Création de `client/public/manifest.json` et balises PWA dans `index.html` pour installation sur le bureau Windows/Mac.
  * **P2 - Migration TanStack Query v5 Complète sur AnalyticsView** :
    * Remplacement des requêtes manuelles `fetch` de `AnalyticsView.tsx` par des hooks `useQuery`.
  * **P3 - Optimisation du Chunking de Vite (Vendor Splitting)** :
    * Configuration `manualChunks` dans `vite.config.ts` divisant le bundle en morceaux optimisés (`vendor-react`, `vendor-recharts`, `vendor-icons`, `vendor-query`).
  * **T2 - Version Dynamique de la Route Santé** :
    * `/api/health` renvoie désormais dynamiquement la version active `0.07`.
  * **Tests Automatisés Étoffés** :
    * Extension de la suite de tests `server/src/tests/rollover.test.ts` validant les plafonds budgétaires et allocations d'épargne (9/9 tests réussis).

### [Version 0.06] - 2026-10-15
* **Résolution Intégrale de l'Audit Architectural & Qualité (audit151026.md)** :
  * **C1 - Migrations SQLite Versionnées** : Création de `server/src/db/migrator.ts` avec table `schema_versions` et migrations séquentielles 1 à 5 appliquées automatiquement au boot.
  * **C2 - Importation Complète de Sauvegarde JSON** : Implémentation de `POST /api/backup/import/json` avec transaction atomique ACID restaurant ménage, catégories, sous-catégories, templates récurrents et transactions. Bouton et sélecteur de fichier intégrés dans `CategoriesView.tsx`.
  * **H1 - Découpage Modulaire de l'API Backend** : Remplacement du fichier monolithique `api.ts` par 6 sous-routeurs thématiques (`months.ts`, `transactions.ts`, `categories.ts`, `stats.ts`, `backup.ts`, `onboarding.ts`) montés sur `apiRouter` avec gestionnaire d'erreurs centralisé `errorHandler.ts`.
  * **H2 - Typage TypeScript Strict (0 `as any`)** : Typage systématique des handlers et requêtes SQL avec les interfaces de `schema.ts`.
  * **H3 - Index de Performance sur template_id** : Création de `idx_transactions_template_id` garantissant une jointure ultra-rapide sur gros volumes.
  * **H4 - Versionnage Dynamique des Sauvegardes** : Récupération dynamique de la version depuis le `package.json` applicatif.
  * **H5 - Nettoyage des Couleurs Hardcodées Sombre** : Migration vers des variables CSS universelles `--app-bg`, `--app-text`, `--app-subtext`.
  * **N1 - Découpage Modulaire de TransactionsTableView** : Extraction de `SearchBar.tsx`, `AddTransactionForm.tsx`, et `TransactionRow.tsx` dans `client/src/components/transactions/`.
  * **N2 - Découpage Modulaire de CategoriesView** : Extraction de `CategoryCard.tsx`, `SubcategoryEditor.tsx`, et `NewCategoryModal.tsx` dans `client/src/components/categories/`.
  * **N3 - Migration TanStack Query v5** : Remplacement de tous les `useEffect`/`fetch` par `useQuery` et `useMutation` dans `App.tsx` avec invalidations fines de cache.
  * **N4 - Clôture Formelle de Mois** : Ajout des routes `PATCH /api/months/:monthYear/close` et `reopen`, avec indicateur et bouton d'action visuels dans `MonthHeader.tsx`.
  * **N5 - Courbe Journalière de Trésorerie (AreaChart)** : Endpoint `GET /api/months/:monthYear/daily-curve` et graphique d'évolution quotidienne du solde dans `AnalyticsView.tsx`.
  * **N6 - Top 5 des Postes de Dépenses** : Endpoint `GET /api/stats/top-categories` et widget dédié dans `DashboardView.tsx` et `AnalyticsView.tsx`.
  * **N7 - Raccourci Clavier Global 'N'** : Raccourci 'N' basculant instantanément le formulaire d'ajout rapide (avec protection des champs de texte).
  * **N8 - Suppression d'Imports Inutilisés** : Nettoyage des imports morts dans `rolloverService.ts`.
  * **E1 - Accessibilité Clavier et ARIA** : Attribution des rôles `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, étiquettes `aria-label` et fermeture universelle sur touche Escape.
  * **E2 - Suite de Tests Automatisée Native** : Implémentation de `server/src/tests/rollover.test.ts` via `node:test` et `node:assert/strict` (7/7 tests exécutés et validés en 160ms).
  * **E3 - Architecture Refresh Token Sécurisée** : Séparation Access Token (15 min) + Refresh Token (7 jours) avec stockage chiffré dans SQLite, rotation automatique et révocation au logout.
  * **E4 - Colonnes et Index Multi-Profils `user_id`** : Migration v4 ajoutant `user_id` sur toutes les tables principales.
  * **E5 - Précision et Arrondi Monétaire Strict** : Création du helper `roundCurrency` dans `dbHelpers.ts` garantissant l'absence de dérive flottante IEEE 754.
  * **E6 - Script Bloquant Anti-FOUC** : Injection dans `<head>` de `index.html` d'un script synchrone appliquant la classe de thème avant le premier paint.
* **Nouvelles Fonctionnalités Utilisateur (Demandes Spécifiques)** :
  * **Dialogue de portée lors de la mise en attente (ToggleScopeModal)** : Lorsqu'une dépense répétée est mise en attente, une modale demande si l'action s'applique uniquement à ce mois ou également aux mois suivants (passant le modèle en `PENDING_PAUSED`).
  * **Capacité d'Épargne & Taux d'Épargne** : Nouvelle carte KPI avec icône `PiggyBank` affichant la capacité d'épargne en euros et le pourcentage du taux d'épargne en direct.
  * **Refonte Thème Clair (Pastel Bleu / Vert)** : Remplacement complet des teintes grises par une palette pastel fraîche, aérée et moderne (`#f0f7fa`, `#ffffff`, `#cfe2ed`, `#0c2b3a`, `#0284c7`, `#059669`).

### [Version 0.05] - 2026-10-15
* **Refactorisation & Découpage Modulaire de l'Assistant d'Onboarding** :
  * Découpage complet du fichier monolithique `OnboardingWizard.tsx` (1270 lignes -> ~290 lignes d'orchestration) en sous-modules dédiés dans `client/src/components/onboarding/` :
    * `types.ts` : Types TypeScript et interfaces partagés (`TemplateDraft`, `StepProps`).
    * `Step1Household.tsx` : Composition du foyer (adultes, enfants, animaux, jour de paie).
    * `Step2Income.tsx` : Rentrées d'argent générées selon le foyer et aides sociales/CAF.
    * `Step3Housing.tsx` : Statut d'habitation, loyer, prêts immobiliers multiples avec date de fin.
    * `Step4Loans.tsx` : Autres crédits (auto, conso, split-pay) avec date d'extinction.
    * `Step5RecurringExpenses.tsx` : Forfaits mobiles configurables nominativement et charges fixes.
    * `Step6Summary.tsx` : Synthèse financière en temps réel (KPIs, reste à vivre) et bilan.
* **Correction & Réactivité Immédiate du Report de Solde M-1** :
  * Correction dans `RolloverEngine.initializeOrSyncMonth` : mise à jour dynamique du champ `carried_over_from_previous` dans `monthly_balances` dès que l'utilisateur coche ou décoche la case *"Reporter le solde net de M-1"*, même sur un mois déjà initialisé.
  * Si la case est décochée, le report est remis à 0 € en direct ; si elle est cochée, le solde net calculé de M-1 est réinjecté immédiatement dans le calcul du reste à vivre sans nécessiter d'opération manuelle en base.
* **Personnalisation Avancée des Forfaits Mobiles dans l'Assistant de Première Connexion** :
  * Dans l'étape 5 de l'Onboarding (`Step5RecurringExpenses.tsx`), ajout d'un sélecteur de quantité dynamique (`-` / `+`) pour le nombre de forfaits mobiles du foyer (initialisé par défaut sur le nombre d'adultes).
  * Pour chaque forfait, ajout d'un champ de saisie dédié au **Libellé personnalisable** (ex: *"Forfait Julien"*, *"Forfait Marie"*, *"Forfait Ado"*) couplé à son montant mensuel distinct.
  * Création de transactions récurrentes distinctes avec leurs libellés respectifs rattachées à la sous-catégorie *Téléphonie & Forfaits mobiles*.
* **Clarification Pédagogique du Report de Solde Net M-1** :
  * Ajout d'une infobulle d'aide explicative (`ℹ️`) dans l'en-tête de mois (`MonthHeader.tsx`) détaillant l'impact du toggle (mode flux tendu indépendant vs trésorerie continue cumulée).

### [Version 0.04] - 2026-10-15
* **Assistant de Première Connexion (Onboarding Wizard) en 6 Étapes** :
  * Création de la table `household_profile` (singleton `id = 1`) pour mémoriser les adultes, enfants, animaux, statut d'habitation et jour de paie par défaut.
  * Création du composant plein écran interactif `client/src/components/OnboardingWizard.tsx` :
    * Étape 1 : Composition du foyer (compteurs interactifs, jour de paie).
    * Étape 2 : Rentrées d'argent dynamiques selon le nombre d'adultes et pré-sélection d'aides/CAF.
    * Étape 3 : Logement et crédits immobiliers multiples (PTZ, assurance emprunteur séparée, copro, taxe foncière).
    * Étape 4 : Autres crédits & remboursements avec saisie de la date d'extinction (`end_month_year`).
    * Étape 5 : Charges habituelles (énergie, télécoms, assurances, enfants, abonnements).
    * Étape 6 : Synthèse financière en temps réel (Revenus, Charges fixes, Reste à vivre estimé) et validation en une transaction atomique.
* **Extinction Automatique des Crédits & Abonnements** :
  * Ajout de la colonne `end_month_year` (`YYYY-MM`) sur `recurring_templates`.
  * Modification du `RolloverEngine` : un modèle n'est dupliqué sur le mois `M` que si `end_month_year IS NULL OR end_month_year >= M`. Dès que `M` dépasse la date d'échéance, la ligne cesse de se générer automatiquement.
* **Règle de Propagation Temporelle & Garantie d'Intégrité Historique** :
  * Implémentation de `updateTransactionWithScope(transactionId, data, scope)` dans `RolloverEngine` et intégration dans la route `PATCH /api/transactions/:id`.
  * Intégration du composant `UpdateScopeModal.tsx` lors de l'édition d'une opération récurrente :
    * Choix 1 : *Modifier uniquement pour ce mois (`M`)* -> met à jour uniquement la ligne du mois sans altérer le modèle.
    * Choix 2 : *Modifier pour ce mois (`M`) ET tous les mois à venir (`>= M`)* -> met à jour le modèle et exécute `UPDATE transactions WHERE template_id = @id AND month_year >= @M`.
    * **Garantie SQL** : Les mois passés (`< M`) ne sont jamais altérés, préservant l'intégrité comptable historique.
* **Validation par Test Automatisé** :
  * Création et exécution avec succès du script de test `server/src/db/verifyPropagation.ts`.

### [Version 0.03] - 2026-10-15
* **Mise en œuvre des Recommandations d'Audit Prioritaires (P1 à P4)** :
  * **P1 - Sauvegardes & Exports Autonomes** :
    * Implémentation des endpoints `GET /api/backup/export/json` (export complet JSON avec horodatage) et `GET /api/backup/export/db` (téléchargement direct du fichier SQLite `budget.sqlite`).
    * Ajout de boutons d'export conviviaux dans l'interface `CategoriesView.tsx`.
  * **P2 - Prévention des Pertes de Données Accidentelles** :
    * Ajout de modales de confirmation bloquantes avec alerte visuelle avant toute suppression de transaction financière dans `TransactionsTableView.tsx`.
    * Ajout d'une confirmation de suppression pour les sous-catégories dans `CategoriesView.tsx`.
  * **P3 - Persistance SQLite des Challenges WebAuthn avec TTL** :
    * Création de la table `auth_challenges (key TEXT PRIMARY KEY, challenge TEXT, created_at INTEGER)` dans `server/src/db/schema.ts`.
    * Remplacement du stockage volatile en mémoire vive par une persistance sécurisée en base SQLite avec TTL de 5 minutes et nettoyage automatique des entrées expirées dans `server/src/routes/auth.ts`.
  * **P4 - Recherche Textuelle et Filtrage Rapide des Transactions** :
    * Intégration d'une barre de recherche instantanée avec bouton de réinitialisation dans l'en-tête de `TransactionsTableView.tsx`.
    * Filtrage multicritères en temps réel sur le libellé, le nom de catégorie, la sous-catégorie, le montant ou la date.

### [Version 0.02] - 2026-10-15
* **Gestion Avancée des Catégories & Sous-Catégories** :
  * Ajout des endpoints backend `PATCH /api/categories/:id`, `POST /api/categories/:id/subcategories`, `PATCH /api/subcategories/:id`, et `DELETE /api/subcategories/:id`.
  * Refonte de l'interface `CategoriesView.tsx` :
    * Bouton d'édition par catégorie pour modifier le nom et la pastille de couleur.
    * Bouton d'ajout rapide de sous-catégories dans n'importe quelle catégorie existante.
    * Édition inline et suppression des sous-catégories existantes avec confirmation visuelle.
* **Correction de l'Affectation Temporelle des Transactions** :
  * Dérivation automatique et stricte du `month_year` à partir de la date sélectionnée (`date.substring(0, 7)`) au lieu d'imposer le mois actuellement visualisé.
  * Synchronisation automatique de la vue frontend : si l'utilisateur saisit une date du mois précédent (ex: septembre alors qu'il visualisait octobre), l'application enregistre la ligne sur septembre et bascule automatiquement sur septembre pour afficher la nouvelle transaction.
* **Propagation Automatique de la Récurrence Multi-Mois** :
  * Dans `TransactionsTableView.tsx`, ajout d'une case à cocher *"Répéter automatiquement chaque mois (se reportera sur les mois suivants)"* activée par défaut pour les rentrées d'argent et les charges fixes.
  * Création automatique d'une entrée dans `recurring_templates` avec `day_of_month` dérivé du jour de la date saisie et statut respecté (`ACTIVE` ou `PENDING`).
  * Vérification par test automatisé (`server/src/db/verifyMonthRoll.ts`) : une opération récurrente saisie sur septembre est immédiatement et fidèlement répliquée sur octobre lors de son ouverture.
* **Audit Qualité & Support Thème Sombre / Thème Clair** :
  * Réalisation de l'audit technique et architectural complet consigné dans le rapport `audit_report_v0.02.md`.
  * Intégration d'un sélecteur de thème dynamique dans la barre latérale (`Sun` / `Moon`).
  * Support complet du Thème Clair (`body.theme-light`) avec persistance dans le `localStorage` et palette optimisée.

### [Version 0.01] - 2026-10-15
* Initialisation du monorepo npm `/server` et `/client`.
* Schéma SQLite `better-sqlite3` et seed des 20 catégories et 83 sous-catégories.
* Authentification WebAuthn Passkeys, JWT >= 32 caractères, secours Argon2id.
* Moteur de report mensuel initial et règles d'exclusion de `PENDING`.
* Layout desktop sombre complet avec 7 onglets et graphiques Recharts.