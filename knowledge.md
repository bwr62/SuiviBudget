# 🧠 KNOWLEDGE BASE - APPLICATION DE GESTION DE BUDGET (PC)

> **AVERTISSEMENT POUR L'AGENT IA** : Ce fichier est la source de vérité architecturale du projet. Tu DOIS le mettre à jour en temps réel à chaque création ou modification de fichier. Ne supprime jamais l'historique du Changelog.

---

## 1. ÉTAT D'AVANCEMENT DU PROJET
- [x] **Étape 1** : Initialisation Monorepo & Configuration TypeScript (`/server` et `/client`)
- [x] **Étape 2** : Base de données SQLite (`better-sqlite3`) & Seed exhaustif des 20 catégories / 83 sous-catégories
- [x] **Étape 3** : Sécurité maximale (WebAuthn Passkeys + JWT >= 32 chars + Secours Argon2id)
- [x] **Étape 4** : API REST & Moteur de Report Mensuel (`Rollover Engine`) avec ACID et exclusion stricte `PENDING`
- [x] **Étape 5** : Frontend - Layout Desktop (1280px-2560px), Sidebar 7 onglets, Switch rapide & Tableaux dynamiques
- [x] **Étape 6** : Frontend - CRUD Catégories & Statistiques visuelles (`Recharts`)
- [x] **Étape 7** : Audit final, suite de tests d'intégration (idempotence & exclusion `PENDING`) & Versioning v0.01

---

## 2. ARCHITECTURE & STACK TECHNIQUE
* **Version du projet** : `v0.01`
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
| `RolloverService.ts` | Prototype initial de référence | `RolloverEngine`, `MonthlySummary` | - | Archivé |
| `server/package.json` | Dépendances et scripts du backend Node.js | Scripts `dev`, `build`, `seed` | - | Actif |
| `server/tsconfig.json` | Configuration TypeScript stricte du backend | Options `NodeNext`, `strict: true` | - | Actif |
| `server/.env` | Variables d'environnement locales (secret JWT > 32 chars) | Variables d'environnement | - | Actif |
| `server/src/config/env.ts` | Validateur de configuration et de sécurité JWT | `env` | - | Actif |
| `server/src/middlewares/auth.ts` | Middleware d'authentification cookie HttpOnly / Bearer | `requireAuth`, interface `AuthUserPayload` | `server/src/config/env.ts` | Actif |
| `server/src/db/schema.ts` | Schéma DDL SQL et types TypeScript stricts des entités | `DDL_SCHEMA`, interfaces `User`, `Passkey`, `Category`, `Subcategory`, `RecurringTemplate`, `Transaction`, `MonthlyBalance` | - | Actif |
| `server/src/db/index.ts` | Instance SQLite `better-sqlite3` (WAL, FK ON) & init | `db`, `initDatabase` | `server/src/db/schema.ts` | Actif |
| `server/src/db/seed.ts` | Script d'amorçage des 20 catégories et 83 sous-catégories | `SEED_CATEGORIES`, `seedCategories` | `server/src/db/index.ts` | Actif |
| `server/src/db/verifyTest.ts` | Suite de tests automatisés (Rollover, Idempotence, PENDING) | Script de validation | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `server/src/services/rolloverService.ts` | Moteur de report mensuel, transactions ACID & calculs PENDING | `RolloverEngine`, `rolloverService`, `MonthlySummary` | `server/src/db/index.ts` | Actif |
| `server/src/routes/auth.ts` | Routes WebAuthn FIDO2 / Passkeys et secours Argon2id | `authRouter` | `server/src/db/index.ts`, `server/src/config/env.ts` | Actif |
| `server/src/routes/api.ts` | Routes REST CRUD, Rollover, templates et statistiques | `apiRouter` | `server/src/db/index.ts`, `server/src/services/rolloverService.ts` | Actif |
| `server/src/index.ts` | Serveur Express, Helmet, CORS, Rate-limiting | Point d'entrée serveur Express | Routes auth & API | Actif |
| `client/package.json` | Dépendances et scripts du frontend React/Vite | Scripts `dev`, `build`, `lint` | - | Actif |
| `client/tsconfig.json` | Configuration globale TypeScript client | References `tsconfig.app.json`, `tsconfig.node.json` | - | Actif |
| `client/tsconfig.app.json` | Configuration stricte TypeScript de l'application client | Options TypeScript `strict: true` | - | Actif |
| `client/vite.config.ts` | Configuration Vite avec Tailwind CSS et proxy API 3001 | Configuration Vite | - | Actif |
| `client/src/index.css` | Styles de base Tailwind CSS et dark theme par défaut | Directive `@import "tailwindcss";` | - | Actif |
| `client/src/types/index.ts` | Interfaces et types TypeScript partagés côté client | Types entités financières | - | Actif |
| `client/src/store/useUIStore.ts` | Store Zustand pour navigation d'onglets et mois | `useUIStore`, type `TabType` | - | Actif |
| `client/src/components/Sidebar.tsx` | Barre de navigation latérale 7 onglets (260px) | `Sidebar` | `client/src/store/useUIStore.ts` | Actif |
| `client/src/components/MonthHeader.tsx` | En-tête de sélection de mois et toggle de report M-1 | `MonthHeader` | `client/src/store/useUIStore.ts` | Actif |
| `client/src/components/DashboardView.tsx` | Tableau de bord avec 4 KPIs et jauge budgétaire | `DashboardView` | `client/src/types/index.ts` | Actif |
| `client/src/components/TransactionsTableView.tsx` | Tableaux dynamiques avec bascule instantanée PENDING | `TransactionsTableView` | `client/src/types/index.ts` | Actif |
| `client/src/components/CategoriesView.tsx` | Interface de consultation et création de catégories | `CategoriesView` | `client/src/types/index.ts` | Actif |
| `client/src/components/AnalyticsView.tsx` | Graphiques Recharts annuels et répartition catégories | `AnalyticsView` | `client/src/types/index.ts` | Actif |
| `client/src/components/AuthModal.tsx` | Modal WebAuthn Passkeys et déverrouillage de secours | `AuthModal` | `@simplewebauthn/browser` | Actif |
| `client/src/App.tsx` | Composant racine assemblant layout, stores et requêtes | `App` | Tous les composants client | Actif |
| `client/src/main.tsx` | Point d'entrée de l'application React | Root render | `client/src/App.tsx` | Actif |

---

## 4. SCHÉMA SQLite & INDEX ACTIFS

* **Tables actives** :
  * `users` : Comptes utilisateurs (`id`, `username`, `recovery_hash`, `created_at`).
  * `passkeys` : Clés publiques WebAuthn (`credential_id`, `user_id`, `public_key`, `counter`, `transports`).
  * `categories` : 20 catégories système (`id`, `name`, `type`, `icon`, `color`, `is_system`, `is_active`).
  * `subcategories` : 83 sous-catégories avec cascade FK.
  * `recurring_templates` : Modèles d'opérations récurrentes (`carry_over`, `day_of_month`, `status`).
  * `transactions` : Instances réelles mensuelles (`status` ACTIVE / PENDING, `is_carried_over`).
  * `monthly_balances` : Reliquat et clôtures mensuelles (`carried_over_from_previous`).
* **Index de performance & intégrité** :
  * `idx_unique_template_per_month` : UNIQUE sur `transactions(template_id, month_year)` WHERE `template_id IS NOT NULL` (garantie d'idempotence stricte pour le moteur de report).
  * `idx_transactions_month_status` : Index sur `transactions(month_year, status)` pour optimisation des agrégations financières.
  * `idx_transactions_date` : Index sur `transactions(date)`.
  * `idx_subcategories_category_id` : Index sur `subcategories(category_id)`.

---

## 5. LOGIQUE MÉTIER CRITIQUE & ALGORITHMES
### 5.1 Règle d'exclusion des dépenses "En attente" (`PENDING`)
* **Fichier responsable** : `server/src/services/rolloverService.ts` & `server/src/routes/api.ts`.
* **Implémentation vérifiée par test** :
  * Toutes les requêtes d'agrégation filtrent avec `WHERE status = 'ACTIVE'`.
  * Le montant total suspendu est agrégé dans un champ dédié `totalPendingExpenses` (`SUM(CASE WHEN type != 'INCOME' AND status = 'PENDING' THEN amount ELSE 0 END)`).
  * Le calcul du reste à vivre réel (`netBalance = carriedOver + income - activeExpenses`) ne retranche sous aucun prétexte les montants `PENDING`.

### 5.2 Moteur de Report Mensuel (`Rollover Engine`)
* **Fichier responsable** : `server/src/services/rolloverService.ts`.
* **Mécanisme validé** : 
  1. Transaction SQLite ACID.
  2. Création de `monthly_balances` pour le mois cible (avec report configurable du solde net M-1).
  3. Clonage idempotent (`INSERT OR IGNORE`) des `recurring_templates` actifs (`carry_over = 1`) en `transactions`.
  4. Les dépenses imprévues (`UNFORESEEN_EXPENSE`) ne sont jamais répétées.
  5. Ajustement automatique des jours de prélèvement pour les mois courts (28/29/30 jours).

### 5.3 Sécurité (Passkeys & JWT)
* **Vérification au démarrage** : `JWT_SECRET.length >= 32` vérifié dans `server/src/config/env.ts` (crash volontaire avec message explicite si inférieur).
* **Authentification WebAuthn FIDO2** : Flux d'enregistrement et de vérification biométrique/clé de sécurité via `@simplewebauthn/server` et `@simplewebauthn/browser`.
* **Code de secours maître** : Génération d'un code maître haché via `Argon2id` permettant le déverrouillage d'urgence si la Passkey n'est pas disponible.
* **Cookies de session** : Cookie `auth_token` configuré avec `HttpOnly`, `SameSite=Strict`.

---

## 6. CONTRATS D'API (ENDPOINTS REST)

| Méthode | Endpoint | Authentifié | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Non | Statut du serveur et version (`v0.01`) |
| `GET` | `/api/auth/status` | Non | Vérifie s'il existe un compte configuré |
| `POST` | `/api/auth/register/start` | Non | Étape 1 WebAuthn : options de création de passkey |
| `POST` | `/api/auth/register/finish` | Non | Étape 2 WebAuthn : vérification, génération code de secours Argon2id et cookie JWT |
| `POST` | `/api/auth/login/start` | Non | Étape 1 WebAuthn : options d'authentification |
| `POST` | `/api/auth/login/finish` | Non | Étape 2 WebAuthn : vérification compteur anti-rejeu et cookie JWT |
| `POST` | `/api/auth/login/recovery` | Non | Déverrouillage par code de secours avec vérification Argon2id |
| `POST` | `/api/auth/logout` | Oui | Nettoyage du cookie de session |
| `GET` | `/api/auth/me` | Oui | Récupère le profil connecté |
| `GET` | `/api/months/:monthYear` | Oui | Initialisation du mois (Rollover) et retour de `summary` + `transactions` |
| `POST` | `/api/transactions` | Oui | Création d'une transaction financière |
| `PATCH` | `/api/transactions/:id` | Oui | Modification partielle d'une transaction |
| `PATCH` | `/api/transactions/:id/status`| Oui | Bascule instantanée du statut (`ACTIVE` vs `PENDING`) |
| `DELETE`| `/api/transactions/:id` | Oui | Suppression d'une transaction |
| `GET` | `/api/recurring-templates` | Oui | Liste des modèles d'opérations récurrentes |
| `POST` | `/api/recurring-templates` | Oui | Création d'un modèle récurrent |
| `DELETE`| `/api/recurring-templates/:id` | Oui | Suppression d'un modèle récurrent |
| `GET` | `/api/categories` | Oui | Liste des catégories avec leurs sous-catégories |
| `POST` | `/api/categories` | Oui | Création d'une catégorie personnalisée et sous-catégories |
| `GET` | `/api/stats/annual` | Oui | Agrégations annuelles Entrées vs Dépenses (hors PENDING) |
| `GET` | `/api/stats/category-distribution`| Oui| Répartition des dépenses par catégorie pour le mois sélectionné |

---

## 7. JOURNAL DES MODIFICATIONS (CHANGELOG D'AUDIT)

### [Version 0.01] - 2026-10-15
* **Architecture & Socle Monorepo** :
  * Mise en place du monorepo npm avec workspaces `/server` et `/client`.
  * Configuration TypeScript stricte sans `any` implicite (`NodeNext` pour le serveur, `bundler` strict pour le client React).
* **Persistance & Base de Données SQLite** :
  * Implémentation du schéma DDL SQLite dans `server/src/db/schema.ts` avec activation de `WAL`, `foreign_keys = ON`, et index uniques d'idempotence.
  * Création et exécution du script de seed `server/src/db/seed.ts` amorçant les **20 catégories principales** et les **83 sous-catégories** exhaustives du cahier des charges.
* **Sécurité & Authentification WebAuthn / Passkeys** :
  * Garde-fou d'entropie au démarrage du serveur : crash volontaire immédiat si `JWT_SECRET.length < 32`.
  * Implémentation complète de l'authentification sans mot de passe FIDO2 / Passkeys (`@simplewebauthn/server` et `@simplewebauthn/browser`).
  * Système de secours d'urgence par code maître haché via `Argon2id`.
  * Middleware de protection des routes par JWT stocké dans un cookie `HttpOnly` `SameSite=Strict`.
* **Moteur de Report Mensuel (Rollover Engine)** :
  * Implémentation de `RolloverEngine` dans `server/src/services/rolloverService.ts`.
  * Respect de la règle métier critique : exclusion stricte des dépenses en statut `PENDING` de tous les totaux, statistiques et reste à vivre.
  * Report automatique et idempotent des modèles récurrents avec `carry_over = 1` lors de la sélection d'un nouveau mois.
* **Interface Utilisateur Desktop (React 19, Tailwind CSS, Recharts)** :
  * Création de la barre de navigation latérale 7 onglets (`Sidebar.tsx`, 260px).
  * Création de l'en-tête de navigation de mois (`MonthHeader.tsx`) avec flèches précédent/suivant et option de report du solde net M-1.
  * Création du Tableau de bord synthétique (`DashboardView.tsx`) avec les 4 cartes KPI, la jauge de répartition budgétaire et les derniers mouvements.
  * Création du composant de tableau dynamique (`TransactionsTableView.tsx`) avec saisie rapide, switch instantané actif / en attente (`PENDING`) et badge visuel dédié.
  * Interface de gestion des catégories et sous-catégories (`CategoriesView.tsx`) avec modal de création.
  * Module d'analyse graphique interactif (`AnalyticsView.tsx`) utilisant Recharts (barres comparatives annuelles et donut de répartition).
  * Modal d'accueil et d'authentification Passkey/Secours (`AuthModal.tsx`).
* **Tests & Validation** :
  * Création et exécution du script `server/src/db/verifyTest.ts` validant avec succès l'idempotence stricte, l'isolation des statuts `PENDING` et le recalcul instantané des totaux.
  * Compilation TypeScript sans erreur validée sur le serveur (`npm run build -w server`) et sur le client (`npm run build -w client`).