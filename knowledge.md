# 🧠 KNOWLEDGE BASE - APPLICATION DE GESTION DE BUDGET (PC)

> **AVERTISSEMENT POUR L'AGENT IA** : Ce fichier est la source de vérité architecturale du projet. Tu DOIS le mettre à jour en temps réel à chaque création ou modification de fichier. Ne supprime jamais l'historique du Changelog.

---

## 1. ÉTAT D'AVANCEMENT DU PROJET
- [x] **Étape 1** : Initialisation Monorepo & Configuration TypeScript (`/server` et `/client`)
- [x] **Étape 2** : Base de données SQLite (`better-sqlite3`) & Seed exhaustif des 20 catégories / 83 sous-catégories
- [x] **Étape 3** : Sécurité maximale (WebAuthn Passkeys + JWT >= 32 chars + Secours Argon2id)
- [x] **Étape 4** : API REST & Moteur de Report Mensuel (`Rollover Engine`) avec ACID et exclusion stricte `PENDING`
- [x] **Étape 5** : Frontend - Layout Desktop (1280px-2560px), Sidebar 7 onglets, Switch rapide & Tableaux dynamiques
- [x] **Étape 6** : Frontend - CRUD Catégories (édition, ajout de sous-catégories) & Statistiques visuelles (`Recharts`)
- [x] **Étape 7** : Audit final, suite de tests d'intégration (idempotence, report automatique M à M+1 & exclusion `PENDING`) & Versioning

---

## 2. ARCHITECTURE & STACK TECHNIQUE
* **Version du projet** : `v0.05`
* **Architecture** : Monorepo npm avec workspaces (`server`, `client`).
* **Frontend** : React 19, Vite 8, TypeScript strict (`ES2022`, `bundler`), Tailwind CSS (v4 via `@tailwindcss/vite`), Zustand, TanStack Query, Recharts, Lucide React, SimpleWebAuthn Browser (`Port: 5173`, proxy configuré vers `http://localhost:3001/api`).
* **Backend** : Node.js (v26), Express, TypeScript strict (`ES2022`, `NodeNext`), Zod, SimpleWebAuthn Server, Argon2id, JWT (vérification stricte de secret >= 32 chars au démarrage), Helmet, CORS verrouillé, Cookie-parser, Express Rate Limit (`Port: 3001`).
* **Base de données** : SQLite locale via `better-sqlite3` (`server/data/budget.sqlite`) en mode `WAL` (Write-Ahead Logging) avec `foreign_keys = ON` et `synchronous = NORMAL`.

---

## 3. REGISTRE EXHAUSTIF DES FICHIERS

| Chemin du Fichier | Rôle & Responsabilité | Exports Principaux (Fonctions / Composants) | Dépendances Internes | Statut |
| :--- | :--- | :--- | :--- | :--- |
| `package.json` | Racine du monorepo npm | Scripts `dev:server`, `dev:client`, `build:server`, `build:client`, `seed` | - | Actif |
| `SPECIFICATIONS.md` | Cahier des charges technique et fonctionnel | - | - | Actif |
| `knowledge.md` | Base documentaire vivante du projet | - | - | Actif |
| `.gitignore` | Exclusion de node_modules, dist et bases sqlite | - | - | Actif |
| `RolloverService.ts` | Prototype initial de référence | `RolloverEngine`, `MonthlySummary` | - | Archivé |
| `server/package.json` | Dépendances et scripts du backend Node.js | Scripts `dev`, `build`, `seed` | - | Actif |
| `server/tsconfig.json` | Configuration TypeScript stricte du backend | Options `NodeNext`, `strict: true` | - | Actif |
| `server/.env` | Variables d'environnement locales (secret JWT > 32 chars) | Variables d'environnement | - | Actif |
| `server/src/config/env.ts` | Validateur de configuration et de sécurité JWT | `env` | - | Actif |
| `server/src/middlewares/auth.ts` | Middleware d'authentification cookie HttpOnly / Bearer | `requireAuth`, interface `AuthUserPayload` | `server/src/config/env.ts` | Actif |
| `server/src/db/schema.ts` | Schéma DDL SQL et types TypeScript stricts des entités | `DDL_SCHEMA`, interfaces entités | - | Actif |
| `server/src/db/index.ts` | Instance SQLite `better-sqlite3` (WAL, FK ON) & init | `db`, `initDatabase` | `server/src/db/schema.ts` | Actif |
| `server/src/db/seed.ts` | Script d'amorçage des 20 catégories et 83 sous-catégories | `SEED_CATEGORIES`, `seedCategories` | `server/src/db/index.ts` | Actif |
| `server/src/db/verifyTest.ts` | Suite de tests automatisés (Rollover, Idempotence, PENDING) | Script de validation | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `server/src/db/verifyMonthRoll.ts` | Test de report automatique multi-mois (Septembre -> Octobre) | Script de validation | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `server/src/services/rolloverService.ts` | Moteur de report mensuel, transactions ACID & calculs PENDING | `RolloverEngine`, `rolloverService`, `MonthlySummary` | `server/src/db/index.ts` | Actif |
| `server/src/routes/auth.ts` | Routes WebAuthn FIDO2 / Passkeys et secours Argon2id | `authRouter` | `server/src/db/index.ts`, `server/src/config/env.ts` | Actif |
| `server/src/routes/api.ts` | Routes REST CRUD transactions, templates, catégories & sous-catégories | `apiRouter` | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `server/src/index.ts` | Serveur Express, Helmet, CORS, Rate-limiting | Point d'entrée serveur Express | Routes auth & API | Actif |
| `client/package.json` | Dépendances et scripts du frontend React/Vite | Scripts `dev`, `build`, `lint` | - | Actif |
| `client/tsconfig.app.json` | Configuration stricte TypeScript de l'application client | Options TypeScript `strict: true` | - | Actif |
| `client/vite.config.ts` | Configuration Vite avec Tailwind CSS et proxy API 3001 | Configuration Vite | - | Actif |
| `client/src/index.css` | Styles de base Tailwind CSS et dark theme par défaut | Directive `@import "tailwindcss";` | - | Actif |
| `client/src/types/index.ts` | Interfaces et types TypeScript partagés côté client | Types entités financières | - | Actif |
| `client/src/store/useUIStore.ts` | Store Zustand pour navigation d'onglets et mois | `useUIStore`, type `TabType` | - | Actif |
| `client/src/components/Sidebar.tsx` | Barre de navigation latérale 7 onglets (260px) | `Sidebar` | `client/src/store/useUIStore.ts` | Actif |
| `client/src/components/MonthHeader.tsx` | En-tête de sélection de mois et toggle de report M-1 | `MonthHeader` | `client/src/store/useUIStore.ts` | Actif |
| `client/src/components/DashboardView.tsx` | Tableau de bord avec 4 KPIs et jauge budgétaire | `DashboardView` | `client/src/types/index.ts` | Actif |
| `client/src/components/TransactionsTableView.tsx` | Tableaux dynamiques avec case à cocher récurrence et bascule PENDING | `TransactionsTableView` | `client/src/types/index.ts` | Actif |
| `client/src/components/OnboardingWizard.tsx` | Assistant de première connexion en 6 étapes (Foyer, Revenus, Logement, Crédits, Charges, Bilan) | `OnboardingWizard` | `client/src/types/index.ts` | Actif |
| `client/src/components/UpdateScopeModal.tsx` | Boîte de dialogue de choix de portée temporelle (Mois courant vs Mois courant + Futurs) | `UpdateScopeModal` | - | Actif |
| `server/src/db/verifyPropagation.ts` | Test automatisé de propagation temporelle et d'extinction de prêt | Script de validation | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `client/src/components/CategoriesView.tsx` | Gestion complète : modification catégorie/sous-catégorie & ajout | `CategoriesView` | `client/src/types/index.ts` | Actif |
| `client/src/components/AnalyticsView.tsx` | Graphiques Recharts annuels et répartition catégories | `AnalyticsView` | `client/src/types/index.ts` | Actif |
| `client/src/components/AuthModal.tsx` | Modal WebAuthn Passkeys et déverrouillage de secours | `AuthModal` | `@simplewebauthn/browser` | Actif |
| `client/src/App.tsx` | Composant racine assemblant layout, stores et synchronisation mois | `App` | Tous les composants client | Actif |
| `client/src/main.tsx` | Point d'entrée de l'application React | Root render | `client/src/App.tsx` | Actif |

---

## 4. SCHÉMA SQLite & INDEX ACTIFS

* **Tables actives** :
  * `users` : Comptes utilisateurs (`id`, `username`, `recovery_hash`, `created_at`).
  * `passkeys` : Clés publiques WebAuthn (`credential_id`, `user_id`, `public_key`, `counter`, `transports`).
  * `auth_challenges` : Stockage SQLite temporaire des challenges FIDO2 avec TTL de 5 minutes.
  * `household_profile` : Profil singleton (`id = 1`) stockant la composition du foyer (`adults_count`, `children_count`, `pets_count`), le statut de logement (`housing_status`), le jour de paie par défaut (`payday_default`) et l'indicateur `has_completed_onboarding`.
  * `categories` : Catégories système et personnalisées (`id`, `name`, `type`, `icon`, `color`, `is_system`, `is_active`).
  * `subcategories` : Sous-catégories avec cascade FK.
  * `recurring_templates` : Modèles d'opérations récurrentes (`carry_over`, `day_of_month`, `status`, et `end_month_year` pour extinction programmée).
  * `transactions` : Instances réelles mensuelles (`status` ACTIVE / PENDING, `is_carried_over`, `month_year` dérivé de `date`).
  * `monthly_balances` : Reliquat et clôtures mensuelles (`carried_over_from_previous`).
* **Index de performance & intégrité** :
  * `idx_unique_template_per_month` : UNIQUE sur `transactions(template_id, month_year)` WHERE `template_id IS NOT NULL`.
  * `idx_transactions_month_status` : Index sur `transactions(month_year, status)`.
  * `idx_transactions_date` : Index sur `transactions(date)`.
  * `idx_subcategories_category_id` : Index sur `subcategories(category_id)`.

---

## 5. LOGIQUE MÉTIER CRITIQUE & ALGORITHMES
### 5.1 Règle d'exclusion des dépenses "En attente" (`PENDING`)
* **Fichier responsable** : `server/src/services/rolloverService.ts` & `server/src/routes/api.ts`.
* Toutes les agrégations financières filtrent avec `WHERE status = 'ACTIVE'`.
* Le reste à vivre réel (`netBalance = carriedOver + income - activeExpenses`) ne déduit jamais les dépenses `PENDING`.
* Le switch 1 clic permet de passer une dépense en attente et de suspendre sa répétition future ou de la réactiver instantanément.

### 5.2 Moteur de Report Mensuel (`Rollover Engine`) & Dérivation de Date
* **Dérivation stricte de `month_year`** : Lors de la création d'une transaction, son mois d'affectation (`month_year`) est extrait directement de sa date (`date.substring(0, 7)`). Si l'utilisateur saisit une date du 15/09 alors qu'il consulte octobre, la transaction est enregistrée sur septembre (2026-09) et l'interface bascule directement sur le mois correspondant.
* **Propagation de la récurrence multi-mois** : Lorsqu'une dépense répétitive ou un revenu récurrent est créé, une entrée correspondante est inscrite dans `recurring_templates` (`carry_over = 1`). Lors de la consultation de tout mois ultérieur (ex: octobre), le moteur de report duplique fidèlement l'opération avec sa date ajustée et son statut.

---

## 6. CONTRATS D'API (ENDPOINTS REST)

| Méthode | Endpoint | Authentifié | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Non | Statut du serveur et version |
| `GET` | `/api/auth/status` | Non | Statut initial compte configuré |
| `POST` | `/api/auth/register/start` | Non | Options WebAuthn enregistrement |
| `POST` | `/api/auth/register/finish` | Non | Vérification WebAuthn & code de secours Argon2id |
| `POST` | `/api/auth/login/start` | Non | Options WebAuthn login |
| `POST` | `/api/auth/login/finish` | Non | Vérification WebAuthn & cookie JWT |
| `POST` | `/api/auth/login/recovery` | Non | Secours par code maître Argon2id |
| `POST` | `/api/auth/logout` | Oui | Nettoyage cookie de session |
| `GET` | `/api/auth/me` | Oui | Profil session active |
| `GET` | `/api/months/:monthYear` | Oui | Initialisation / Rollover du mois et agrégats |
| `POST` | `/api/transactions` | Oui | Création de transaction (dérivation date -> mois & option récurrence) |
| `PATCH` | `/api/transactions/:id` | Oui | Modification partielle de transaction |
| `PATCH` | `/api/transactions/:id/status`| Oui | Bascule `ACTIVE` vs `PENDING` |
| `DELETE`| `/api/transactions/:id` | Oui | Suppression transaction |
| `GET` | `/api/recurring-templates` | Oui | Liste des modèles récurrents |
| `POST` | `/api/recurring-templates` | Oui | Création d'un modèle récurrent |
| `PATCH` | `/api/recurring-templates/:id`| Oui | Modification d'un modèle récurrent |
| `DELETE`| `/api/recurring-templates/:id` | Oui | Suppression modèle |
| `GET` | `/api/categories` | Oui | Liste complète catégories + sous-catégories |
| `POST` | `/api/categories` | Oui | Création d'une catégorie |
| `PATCH` | `/api/categories/:id` | Oui | **NOUVEAU** : Modification du nom/couleur d'une catégorie existante |
| `POST` | `/api/categories/:id/subcategories` | Oui | **NOUVEAU** : Ajout d'une sous-catégorie à une catégorie existante |
| `PATCH` | `/api/subcategories/:id` | Oui | **NOUVEAU** : Renommage d'une sous-catégorie |
| `DELETE`| `/api/subcategories/:id` | Oui | **NOUVEAU** : Suppression d'une sous-catégorie |
| `GET` | `/api/onboarding/status` | Oui | **NOUVEAU** : État d'avancement de l'onboarding et profil du foyer |
| `POST` | `/api/onboarding/complete` | Oui | **NOUVEAU** : Finalisation de l'onboarding et génération initiale du budget |
| `GET` | `/api/backup/export/json` | Oui | **P1** : Sauvegarde et export complet des données au format JSON |
| `GET` | `/api/backup/export/db` | Oui | **P1** : Téléchargement du fichier de base de données SQLite brut |
| `GET` | `/api/stats/annual` | Oui | Statistiques annuelles (hors PENDING) |
| `GET` | `/api/stats/category-distribution`| Oui| Répartition par catégorie |

---

## 7. JOURNAL DES MODIFICATIONS (CHANGELOG D'AUDIT)

### [Version 0.05] - 2026-10-15
* **Personnalisation Avancée des Forfaits Mobiles dans l'Assistant de Première Connexion** :
  * Dans l'étape 5 de l'Onboarding (`OnboardingWizard.tsx`), ajout d'un sélecteur de quantité dynamique (`-` / `+`) pour le nombre de forfaits mobiles du foyer (initialisé par défaut sur le nombre d'adultes).
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